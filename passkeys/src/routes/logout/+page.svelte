<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => goto('/login/password'));
</script>

<div>
	<h1>Logout</h1>
</div>
