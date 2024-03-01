<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { Input } from '$lib/components/ui/input';
	import { extractFormValues, getFormValue } from '$lib/tools/formtools';
	import { dlog } from '$lib/tools/log.js';
	import { onMount } from 'svelte';
	import { CheckCircle, XCircle } from 'lucide-svelte';
	import { cFetch } from '$lib/tools/fetchclient.js';
	import { page } from '$app/stores';

	export let data;

	let formData = {};
	let successMessage = '';
	let formError = '';
	let submitting = false;
	let passwordChecks: { type: string; message: string; valid: boolean }[] =
		[];
	let checksPassing = true;

	function getForm(id = 'form-new-password') {
		const form = document.getElementById(id);
		if (!form) {
			throw new Error(`Form ${id} not found`);
		}
		return form as HTMLFormElement;
	}

	async function postNewPassword(arg: {
		password: string;
		passwordConfirm: string;
	}) {
		submitting = true;
		const res = await cFetch.post(
			`/login/password/reset/${$page.params.code}`,
			{
				...arg,
				challenge: $page.params.code,
			},
		);
		if (res.ok) {
			successMessage = 'Your password was changed, you can now login';
		} else {
			const body = await res.json();
			formError =
				body.message || 'An Error occured, could not change password';
		}
		submitting = false;
	}

	async function validatePassword() {
		dlog('running password checks');
		const testMap = [
			{
				type: 'length',
				message: 'Password must be at least 8 characters long',
				test: (p: string) => p.length >= 8,
			},
			// {
			// 	type: 'uppercase',
			// 	message: 'Password must contain at least one uppercase letter',
			// 	test: (p: string) => /[A-Z]/.test(p)
			// },
			// {
			// 	type: 'lowercase',
			// 	message: 'Password must contain at least one lowercase letter',
			// 	test: (p: string) => /[a-z]/.test(p)
			// },
			// {
			// 	type: 'number',
			// 	message: 'Password must contain at least one number',
			// 	test: (p: string) => /[0-9]/.test(p)
			// },
			// {
			// 	type: 'special',
			// 	message: 'Password must contain at least one special character',
			// 	test: (p: string) => /[!@#$%^&*()_+{}|:<>?]/.test(p)
			// }
		];

		const form = getForm();
		const formData = new FormData(form);
		let valid = true;
		if (form) {
			const password = getFormValue(formData, 'password');
			const confirmPassword = getFormValue(formData, 'passwordConfirm');
			dlog('passwords', { password, confirmPassword });
			if (password !== confirmPassword) {
				formError = 'Passwords do not match';
				valid = false;
				return false;
			} else {
				formError = '';
			}

			passwordChecks = testMap.map(t => {
				const checked = t.test(password);
				valid = checked;
				return { type: t.type, message: t.message, valid: checked };
			});
		}

		checksPassing = valid;
		return valid;
	}

	onMount(() => {
		if (import.meta.env.DEV) {
			formData = { password: 'password', passwordConfirm: 'password' };
		}
	});
</script>

{#if !data.challenge}
	<div class="invalid">
		<p>Invalid reset code</p>
	</div>
{:else if data.challenge.used}
	<div class="invalid">
		<p>This code has already been used</p>
	</div>
{:else}
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

		<h2>Enter your new password</h2>
		<p>This will be the password to use moving forward</p>

		<form
			id="form-new-password"
			method="post"
			on:submit={async e => {
				e.preventDefault();
				const valid = await validatePassword();
				if (!valid) {
					return;
				}
				const formData = new FormData(e.currentTarget);
				const form = extractFormValues(
					formData,
					'password',
					'passwordConfirm',
				);
				if (form.password !== form.passwordConfirm) {
					formError = 'Passwords do not match';
					return;
				}
				postNewPassword(form);
			}}
		>
			<div class="error">{formError}</div>
			<div class="color-green">{successMessage}</div>
			{#if successMessage.length > 0}
				<a href="/login/password">Click here to go to login</a>
			{/if}
			<div />
			<Input
				type="password"
				id="password"
				name="password"
				label="New Password"
				placeholder="very complex password"
				value={getFormValue(formData, 'password')}
				on:blur={validatePassword}
				autocomplete="new-password"
				required
			/>
			<Input
				type="password"
				id="passwordConfirm"
				name="passwordConfirm"
				label="Confirm New Password"
				placeholder="very complex password"
				value={getFormValue(formData, 'passwordConfirm')}
				on:blur={validatePassword}
				autocomplete="new-password"
				required
			/>
			<div>
				{#each passwordChecks as check}
					<span
						class="flex"
						class:color-green={check.valid}
						class:color-error={!check.valid}
						><span>{check.message}</span>
						{#if check.valid}
							<CheckCircle class="ml-auto" />
						{:else}
							<XCircle class="ml-auto" />
						{/if}
					</span>
				{/each}
			</div>
			<div class="button">
				<div class="flex gap-3">
					<Button
						disabled={submitting || !checksPassing}
						busy={submitting}
						type="submit"
						variant="brand"
						>Save New Password
					</Button>
				</div>
				<br />

				<br />
				<div class="flex gap-5" />
			</div>
		</form>
	</div>
{/if}

<style lang="scss">
	.invalid {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		width: 100vw;

		p {
			font-size: 34px;
		}
	}
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
