import { serverLog as log } from '$lib/server/serverlog';
import type { RequestEvent } from '../$types';
import {
	webauthnAuthenticatePasskey,
	webauthnGetChallenge,
	webauthnRegisterPasskey,
} from './login-logic';

export async function POST(event: RequestEvent) {
	const body = await event.request.json();
	const { action, payload } = body;

	switch (action) {
		case 'challenge': {
			const challengeResponse = await webauthnGetChallenge({
				email: payload.email,
			});
			return Response.json(challengeResponse, { status: 200 });
			break;
		}
		case 'register': {
			const registerResponse = await webauthnRegisterPasskey(payload);
			if (registerResponse.result) {
				return Response.json(registerResponse.result);
			}
			return Response.json(registerResponse.error, { status: 400 });
			break;
		}
		case 'authenticate': {
			const authenticateResponse =
				await webauthnAuthenticatePasskey(payload);
			if (authenticateResponse.result) {
				const value = authenticateResponse.result;
				event.cookies.set('arlk', value.id, {
					maxAge: 604800,
					path: '/',
				});
				return Response.json(value);
			} else {
				return Response.json(authenticateResponse.error, {
					status: 400,
				});
			}
			break;
		}
		default: {
			log.warn('auth unknown action');
			return Response.json(
				{ message: `Unknown action ${action}` },
				{ status: 400 },
			);
		}
	}
}
