import { drizzleDB } from '$lib/server/drizzle/drizzle';
import { getRandomString } from '$lib/tools/identifiers';
import type { RequestHandler } from '@sveltejs/kit';
import * as schema from '$lib/server/drizzle/schema';
import { getError } from '$lib/tools/format';
import { serverLog } from '$lib/server/serverlog';
import { eq } from 'drizzle-orm';
import { dlog } from '$lib/tools/log';

const mailEndpoint = 'https://mailersend.akiza.co/passwordreset';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email } = await request.json();
		const challenge = getRandomString(18);

		const user = (
			await drizzleDB()
				.select()
				.from(schema.logins)
				.where(eq(schema.logins.email, email))
		).at(0);

		if (!user) {
			serverLog.warn('Unknown email tried password reset', { email });
			return Response.json('ok', { status: 200 });
		}

		serverLog.info('Sending password reset email', { email });

		await drizzleDB().insert(schema.webauthnChallenges).values({
			id: challenge,
			email: email,
			origin: request.url,
			used: false,
		});

		const response = await fetch(mailEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email, code: challenge }),
		});

		if (response.ok) {
			return Response.json('sent ok', { status: 200 });
		} else {
			const error = await response.json();
			dlog(error);
			return Response.json(
				{ message: 'Internal Error: Reset code not sent' },
				{ status: 500 },
			);
		}
	} catch (err) {
		const error = getError(err);
		serverLog.errorDump(error);
		return Response.json(
			{ message: 'Internal Error: Reset code not sent' },
			{ status: 500 },
		);
	}
};
