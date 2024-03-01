import { drizzleDB } from '$lib/server/drizzle/drizzle';
import {
	logins,
	sessions,
	webauthn,
	webauthnChallenges,
} from '$lib/server/drizzle/schema';
import { getError } from '$lib/tools/format';
import { generateSessionID, getRandomString } from '$lib/tools/identifiers';
import { log } from '$lib/tools/log';
import { Err, Result } from '$lib/tools/runtime';
import { isValidEmail } from '$lib/tools/validators';
import { server } from '@passwordless-id/webauthn';
import { eq } from 'drizzle-orm';
import {
	createLiteralValidator,
	createRecordValidator,
	isString,
} from 'typechecked';

export async function returnNewSession(login: { id: string }) {
	const newSessionData = {
		id: generateSessionID(),
		loginID: login.id,
		createdAt: new Date().toUTCString(),
	};

	await drizzleDB().insert(sessions).values(newSessionData);
	return Result({
		id: newSessionData.id,
		userID: newSessionData.loginID,
		createdAt: newSessionData.createdAt,
	});
}

export async function webauthnGetChallenge(body: unknown) {
	const validator = createRecordValidator({
		email: isValidEmail,
	});
	const validBody = validator(body);
	const loginRecords = await drizzleDB()
		.select({
			loginId: logins.id,
			credentialId: webauthn.credentialId,
			credential: webauthn.credential,
		})
		.from(logins)
		.leftJoin(webauthn, eq(webauthn.loginId, logins.id))
		.where(eq(logins.email, validBody.email));

	async function returnRegisterChallenge(userHandle: string) {
		const values = {
			challenge: getRandomString(40),
			action: 'register',
			userHandle,
		};
		await drizzleDB().insert(webauthnChallenges).values({
			email: validBody.email,
			id: values.challenge,
			origin: '',
		});
		return values;
	}

	if (loginRecords.length === 0) {
		return returnRegisterChallenge(getRandomString());
	} else if (
		loginRecords.length === 1 &&
		loginRecords.at(0)?.credentialId === null
	) {
		// TODO: remove this escape hatch when we no longer need it
		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		return returnRegisterChallenge(loginRecords.at(0)?.loginId!);
	} else {
		const values = {
			challenge: await getRandomString(20),
			action: 'authenticate',
			credentialIDs: loginRecords
				.filter(rec => rec.credentialId)
				.map(rec => rec.credentialId),
		};
		return values;
	}
}

export async function webauthnRegisterPasskey(
	body: unknown,
): Promise<Result<'ok'>> {
	const validator = createRecordValidator({
		challenge: isString,
		origin: isString,
		userHandle: isString,
		registration: createRecordValidator({
			username: isString,
			credential: createRecordValidator({
				id: isString,
				publicKey: isString,
				algorithm: createLiteralValidator('ES256'),
			}),
			authenticatorData: isString,
			clientData: isString,
		}),
	});
	const validBody = validator(body);
	const expected = {
		challenge: validBody.challenge,
		origin: validBody.origin,
	};
	const registrationParsed = await server.verifyRegistration(
		validBody.registration,
		expected,
	);
	const challengeInDB = (
		await drizzleDB()
			.select()
			.from(webauthnChallenges)
			.where(eq(webauthnChallenges.id, validBody.challenge))
	).at(0);

	if (!challengeInDB) {
		log(
			'warn',
			'detected webauthn authentication attempt with unknown challenge',
		);
		return Err({ message: 'Unknown Challenge' });
	}

	if (!challengeInDB.email) {
		log('warn', 'detected webauthn authentication attempt with no email');
		return Err({ message: 'Corrupted challenge email' });
	}

	await drizzleDB().transaction(async tx => {
		const emailInDB = (
			await tx
				.select()
				.from(logins)
				.where(eq(logins.email, challengeInDB.email!))
		).at(0);

		if (!emailInDB) {
			await tx.insert(logins).values({
				id: validBody.userHandle,
				email: challengeInDB.email,
			});
		}

		await tx.insert(webauthn).values({
			id: getRandomString(8),
			loginId: emailInDB?.id || validBody.userHandle, // if ID already exists, use the existing id
			credentialId: registrationParsed.credential.id,
			credential: registrationParsed.credential,
			origin: validBody.origin,
		});

		// WE may not want to update this just yet
		// Since we could reuse it in the authentication phase
		// await tx
		//     .update(webauthnChallenges)
		//     .set({ used: true })
		//     .where(eq(webauthnChallenges.id, challengeInDB.id));
	});

	return Result('ok');
}

export async function webauthnAuthenticatePasskey(
	body: unknown,
): Promise<Result<{ id: string; userID: string; createdAt: string }>> {
	const validator = createRecordValidator({
		challenge: isString,
		authentication: createRecordValidator({
			credentialId: isString,
			authenticatorData: isString,
			clientData: isString,
			signature: isString,
		}),
	});
	const validBody = validator(body);

	const credential = (
		await drizzleDB()
			.select()
			.from(webauthn)
			.where(
				eq(
					webauthn.credentialId,
					validBody.authentication.credentialId,
				),
			)
	).at(0);

	if (!credential) {
		return Err({ message: 'Unknown passkey' });
	}

	// to validate that the credential is in the correct shape
	const credentialValidator = createRecordValidator({
		id: isString,
		publicKey: isString,
		algorithm: createLiteralValidator('ES256'),
	});

	const credentialKey = credentialValidator(credential.credential);

	const expected = {
		challenge: async (challenge: string) => {
			/* TODO: validate challenge */ return !!challenge;
		},
		origin: (origin: string) => origin === credential.origin,
		userVerified: false,
		counter: credential.counter,
	};

	try {
		await server.verifyAuthentication(
			validBody.authentication,
			credentialKey,
			expected,
		);

		return returnNewSession({ id: credential.loginId });
	} catch (err) {
		return Err(getError(err));
	}
}
