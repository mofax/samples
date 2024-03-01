import { drizzleDB } from '$lib/server/drizzle/drizzle';
import type { RequestHandler } from './$types';
import * as schema from '$lib/server/drizzle/schema';
import { eq } from 'drizzle-orm';
import { turnPasswordToHash } from '$lib/server/authlogic';
import { serverLog } from '$lib/server/serverlog';
import { dlog } from '$lib/tools/log';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();

	const password = body.password;

	if (typeof password !== 'string' || password.length < 8) {
		return Response.json(
			{ message: 'Password must be more than 8 characters' },
			{ status: 400 },
		);
	}

	serverLog.info('Fetching challenge code for password reset', params);
	const challenge = (
		await drizzleDB()
			.select()
			.from(schema.webauthnChallenges)
			.where(eq(schema.webauthnChallenges.id, params.code))
	).at(0);

	if (!challenge) {
		serverLog.info(
			'Did not find challenge code for password reset',
			params,
		);
		return Response.json(
			{ message: 'That code does not exist in our database' },
			{ status: 400 },
		);
	}

	serverLog.info('Found challenge code for password reset', challenge);

	if (challenge.used === true) {
		dlog(challenge);
		return Response.json(
			{ message: 'That code has already been used' },
			{ status: 400 },
		);
	}

	const login = (
		await drizzleDB()
			.select()
			.from(schema.logins)
			.where(eq(schema.logins.email, challenge.email as string))
	).at(0);

	if (!login) {
		serverLog.warn('Invalid email in password reset', challenge);
		return Response.json({ message: 'Invalid email' }, { status: 400 });
	}

	const existingPassword = (
		await drizzleDB()
			.select()
			.from(schema.loginPasswords)
			.where(eq(schema.loginPasswords.id, login.id))
	).at(0);

	const hashedPassword = turnPasswordToHash(password);

	if (existingPassword) {
		await drizzleDB()
			.update(schema.loginPasswords)
			.set({
				password: await hashedPassword,
			});
	} else {
		await drizzleDB()
			.insert(schema.loginPasswords)
			.values({
				id: login.id,
				password: await hashedPassword,
			});
	}

	await drizzleDB()
		.update(schema.webauthnChallenges)
		.set({ used: true })
		.where(eq(schema.webauthnChallenges.id, challenge.id));

	return Response.json('ok');
};
