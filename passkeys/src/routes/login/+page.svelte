<script lang="ts">
	import { client } from '@passwordless-id/webauthn';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Input } from '$lib/components/ui/input';
	import { extractFormValues, getFormValue } from '$lib/tools/formtools';
	import { Fingerprint } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { generateRandomObjectID } from '$lib/tools/identifiers.js';
	import { getError } from '$lib/tools/format';
	import { createToast } from '$lib/components/ui/toast/toast-store';

	let formError = '';
	let supported: boolean | null = null;
	let submitting = false;

	let formData: Record<string, string>;

	async function postDataLoginData(body: {
		action: string;
		payload: Record<string, unknown>;
	}) {
		return fetch('/login', {
			method: 'POST',
			body: JSON.stringify(body),
			headers: {
				'content-type': 'application/json',
			},
		});
	}

	async function webauthnRegister(email: string, challenge: string) {
		const userHandle = generateRandomObjectID();
		const registration = await client.register(email, challenge, {
			authenticatorType: 'auto',
			userVerification: 'preferred',
			timeout: 60000,
			attestation: false,
			userHandle: userHandle,
			debug: false,
		});

		const body = {
			action: 'register',
			payload: {
				challenge,
				userHandle,
				registration,
				origin: location.origin,
			},
		};

		const registerResponse = await postDataLoginData(body);
		if (registerResponse.ok) {
			createToast(
				'A new passkey has been registered, authenticate again to login',
				{
					duration: 5000,
				},
			);
			//  webauthnAuthenticate(email, challenge);
		} else {
			throw new Error('webauthnRegister: Unknown Error');
		}
	}

	async function getWebauthnChallenge(email: string) {
		submitting = true;
		try {
			const challengeResponse = await postDataLoginData({
				action: 'challenge',
				payload: { email },
			});

			const challenge = await challengeResponse.json();
			if (challenge.action === 'register') {
				await webauthnRegister(email, challenge.challenge);
			} else if (challenge.action === 'authenticate') {
				await webauthnAuthenticate(
					email,
					challenge.challenge,
					challenge.credentialIDs,
				);
			}
		} catch (err) {
			formError = getError(err).message;
		} finally {
			submitting = false;
		}
	}

	async function webauthnAuthenticate(
		email: string,
		challenge: string,
		credentialIDs = [],
	) {
		const authentication = await client.authenticate([], challenge, {
			authenticatorType: 'auto',
			userVerification: 'preferred',
			timeout: 60000,
		});
		const body = {
			action: 'authenticate',
			payload: { challenge, authentication },
		};
		const authenticateResponse = await postDataLoginData(body);
		if (authenticateResponse.ok) {
			location.href = '/home';
		} else {
			const resJSON = await authenticateResponse.json();
			formError =
				resJSON.message || 'Passkey authentication: Unknown Error';
		}
	}

	onMount(() => {
		supported = client.isAvailable();
	});
</script>

<div class="wrapper">
	<a
		href="/"
		on:click={e => {
			e.preventDefault();
			window.location.href = '/';
		}}
	>
		<svg
			class="logo"
			width="152"
			height="44"
			viewBox="0 0 152 44"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M28.76 10.424C30.936 10.424 32.408 11.768 32.408 13.752V39.672C32.408 41.656 30.936 43 28.76 43C26.648 43 25.432 41.912 25.176 40.312C22.232 42.616 18.392 43.64 15.192 43.64C5.912 43.64 0.28 36.92 0.28 26.616C0.28 16.696 6.616 9.784 16.024 9.784C18.776 9.784 22.36 10.808 25.176 12.984C25.496 11.448 26.712 10.424 28.76 10.424ZM15.96 37.176C19.736 37.176 23.64 35.512 25.112 32.248V21.176C23.512 18.04 19.864 16.248 16.536 16.248C11.16 16.248 7.576 20.6 7.576 26.68C7.576 33.016 10.904 37.176 15.96 37.176ZM147.948 10.424C150.124 10.424 151.596 11.768 151.596 13.752V39.672C151.596 41.656 150.124 43 147.948 43C145.836 43 144.62 41.912 144.364 40.312C141.42 42.616 137.58 43.64 134.38 43.64C125.1 43.64 119.468 36.92 119.468 26.616C119.468 16.696 125.804 9.784 135.212 9.784C137.964 9.784 141.548 10.808 144.364 12.984C144.684 11.448 145.9 10.424 147.948 10.424ZM135.148 37.176C138.924 37.176 142.828 35.512 144.3 32.248V21.176C142.7 18.04 139.052 16.248 135.724 16.248C130.348 16.248 126.764 20.6 126.764 26.68C126.764 33.016 130.092 37.176 135.148 37.176Z"
				fill="#002BFF"
			/>
			<path
				d="M67.1095 37.496C69.2855 40.184 67.0455 43 64.4855 43C63.3975 43 62.3095 42.488 61.5415 41.592L50.7255 29.56L48.8695 31.224V39.736C48.8695 41.848 46.9495 43 45.1575 43C43.3015 43 41.5735 41.848 41.5735 39.736V4.856C41.5735 0.503998 48.8695 0.503998 48.8695 4.856V22.52L60.7095 11.448C61.4775 10.808 62.5655 10.424 63.3975 10.424C65.4455 10.424 67.1095 11.96 67.1095 13.688C67.1095 14.52 66.6615 15.352 65.7655 16.184L55.7175 25.08L67.1095 37.496ZM80.975 5.624C80.975 7.8 79.055 8.824 77.263 8.824C75.343 8.824 73.551 7.8 73.551 5.624V4.792C73.551 2.616 75.343 1.592 77.263 1.592C79.055 1.592 80.975 2.616 80.975 4.792V5.624ZM73.615 13.56C73.615 11.512 75.535 10.424 77.263 10.424C79.055 10.424 80.911 11.512 80.911 13.496V39.864C80.911 41.976 79.055 43 77.263 43C75.535 43 73.615 41.976 73.615 39.864V13.56ZM95.3845 36.664L111.577 36.6C114.009 36.6 115.289 38.264 115.289 39.864C115.289 41.464 114.073 43 111.577 43H88.4085C85.9125 43 84.5685 41.464 84.5685 39.864C84.5685 39.096 85.0165 38.072 85.7845 37.304L104.025 16.888L89.1125 16.952C86.8085 16.952 85.5285 15.352 85.5285 13.752C85.5285 12.088 86.8085 10.424 89.1125 10.424H111.129C113.433 10.424 114.969 12.088 114.969 13.816C114.969 14.648 114.585 15.416 113.817 16.248L95.3845 36.664Z"
				fill="black"
			/>
		</svg>
	</a>

	{#if supported === false}
		<h2>Unsupported browser</h2>
		<div>
			You are using a browser we don't support<br />
			Please upgrade to the latest version<br /><br />
			We support the latests versions of chrome, edge or safari
		</div>
	{/if}

	{#if supported === true}
		<h2>Enter your email address</h2>
		<h3>
			We will log you in using a <a
				href="https://blog.google/technology/safety-security/the-beginning-of-the-end-of-the-password/"
				target="_blank">passkey</a
			>
		</h3>
		<form
			method="post"
			on:submit={e => {
				e.preventDefault();
				const formData = new FormData(e.currentTarget);
				const form = extractFormValues(
					formData,
					'name',
					'email',
					'confirmEmail',
				);
				if (form.email === form.confirmEmail) {
					getWebauthnChallenge(form.email);
				} else {
					formError = 'Emails do not match';
				}
			}}
		>
			<div class="error">{formError}</div>
			<div>
				<!-- <label for="name">Name</label>
				<Input
					type="text"
					id="name"
					name="name"
					placeholder="Alice Vaunn"
					value={getFormValue(formData, 'name')}
					required
				/>
				<div class="error" /> -->
			</div>
			<Input
				type="email"
				id="email"
				name="email"
				label="Email"
				placeholder="alice@example.com"
				value={getFormValue(formData, 'email')}
				required
			/>
			<Input
				type="email"
				id="confirmEmail"
				name="confirmEmail"
				label="confirmEmail"
				placeholder="alice@example.com"
				value={getFormValue(formData, 'confirmEmail')}
				required
			/>
			<div class="button">
				<Button
					disabled={submitting}
					busy={submitting}
					type="submit"
					variant="primary"
					>Authenticate Passkey
					<Fingerprint />
				</Button>
				<br />
				<a href="/login/password">Use a password instead</a>
			</div>
		</form>
	{/if}
</div>

<style lang="scss">
	.wrapper {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 350px;
		margin: auto;
		padding-top: 56px;
	}

	a {
		color: blue;
		text-decoration: underline;
	}

	h2 {
		font-size: 2rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	form > div {
		display: flex;
		flex-direction: column;
	}

	.button {
		:global(button) {
			margin-right: auto;
			min-width: 180px;
		}
	}

	.logo {
		width: 90px;
	}

	.error {
		color: red;
	}
</style>
