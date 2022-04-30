<template>
	<q-layout view="lHh Lpr lFf">
		<q-header elevated>
			<q-toolbar>
				<q-toolbar-title>Elden Ring Save Manager</q-toolbar-title>
				<q-btn
					:icon="mdiGithub"
					flat
					round
					href="https://github.com/Nisgrak/elden-ring-save-manager"
				></q-btn>
			</q-toolbar>
		</q-header>

		<q-page-container>
			<router-view />
		</q-page-container>
	</q-layout>
</template>

<script lang="ts" setup>
import { mdiGithub } from '@quasar/extras/mdi-v6';
</script>
