import { redirect } from '@sveltejs/kit';
import { PUBLIC_AUTH_COOKIE_NAME } from '$env/static/public';

export function load({ cookies }) {
	// remove the cookie
	cookies.delete(PUBLIC_AUTH_COOKIE_NAME, { path: '/' });

	redirect(300, '/login/password');
}
