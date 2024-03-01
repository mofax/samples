import { json, type RequestHandler } from '@sveltejs/kit';
import { drizzleDB } from '$lib/server/drizzle/drizzle';
import * as schema from '$lib/server/drizzle/schema';
import { eq } from 'drizzle-orm';
import { serverLog } from '$lib/server/serverlog';
import { getRandomString } from '$lib/tools/identifiers';
import {
	isValidPasswordHash,
	returnNewSession,
	turnPasswordToHash,
} from '$lib/server/authlogic';
import { dlog } from '$lib/tools/log';

async function loginWithPassword(values: {
	email: string;
	password: string;
}): Promise<Response | ReturnType<typeof returnNewSession>> {
	dlog(values);
	const errorResponse = (message: string) =>
		json({ message: message }, { status: 401 });

	if (!values) {
		serverLog.error('values was not passed into loginWithPassword()');
		return json({ message: 'Invalid body' }, { status: 500 });
	}

	const loginInfo = (
		await drizzleDB()
			.select()
			.from(schema.logins)
			.innerJoin(
				schema.loginPasswords,
				eq(schema.logins.id, schema.loginPasswords.id),
			)
			.where(eq(schema.logins.email, values.email))
	).at(0);

	if (!loginInfo) {
		serverLog.warn('Attempt to login with unknown email', {
			email: values.email,
		});
		return errorResponse('No password is configured for that email');
	}

	const isValid = await isValidPasswordHash(
		loginInfo.login_passwords.password,
		values.password,
	);

	if (!isValid) {
		dlog('Invalid password');
		return errorResponse('Password cannot be used');
	}

	const session = await returnNewSession({ id: loginInfo.logins.id });

	return session;
}

async function registerWithPassword(values: {
	email: string;
	password: string;
}) {
	const errorResponse = (message?: string) =>
		json(
			{ message: message || 'Unknown email or password' },
			{ status: 401 },
		);

	if (!values) {
		serverLog.error('Values was not passed into loginWithPassword()');
		return json({ message: 'Invalid body' }, { status: 500 });
	}

	if (values.password.length < 8) {
		return errorResponse('Password must be 8 characters or more');
	}

	const loginInfo = (
		await drizzleDB()
			.select()
			.from(schema.logins)
			.where(eq(schema.logins.email, values.email))
	).at(0);

	if (loginInfo) {
		return errorResponse('That email is already taken');
	}

	await drizzleDB().transaction(async tx => {
		const id = getRandomString(12);
		await tx.insert(schema.logins).values({
			id: id,
			email: values.email,
		});
		await tx.insert(schema.loginPasswords).values({
			id: id,
			password: await turnPasswordToHash(values.password),
		});
	});

	return json({ message: 'account created ' });
}

export const POST: RequestHandler = async event => {
	const body = await event.request.json();
	switch (body.action) {
		case 'login': {
			const response = await loginWithPassword(body.payload);
			if (response instanceof Response) {
				return response;
			} else {
				event.cookies.set('arlk', response.result.id, {
					maxAge: 604800,
					path: '/',
				});
				return json(response);
			}
		}
		case 'register': {
			return registerWithPassword(body.payload);
		}
		default: {
			return json(
				{
					message: `"${body.action}" is an invalid action`,
				},
				{ status: 400 },
			);
		}
	}
};
