<script lang="ts">
	import LoginForm from './loginform.svelte';
	import RegistrationForm from './registrationform.svelte';

	let mode = 'login' as 'register' | 'login';
</script>

{#if mode === 'login'}
	<LoginForm toggle={() => (mode = 'register')} />
{/if}

{#if mode === 'register'}
	<RegistrationForm toggle={() => (mode = 'login')} />
{/if}
