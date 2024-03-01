import { drizzleDB } from '$lib/server/drizzle/drizzle';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import * as schema from '$lib/server/drizzle/schema';

export const load: PageServerLoad = async ({ params }) => {
	const code = params.code;
	const challenge = (
		await drizzleDB()
			.select()
			.from(schema.webauthnChallenges)
			.where(eq(schema.webauthnChallenges.id, code))
	).at(0);

	return {
		challenge,
	};
};
