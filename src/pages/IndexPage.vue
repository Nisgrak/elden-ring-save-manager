<template>
	<q-page class="row items-center justify-evenly">
		<div
			class="row items-center justify-center full-width"
			v-if="isCompatible === true"
		>
			<div
				v-if="savesFolder !== undefined"
				class="row justify-center full-width"
			>
				<div class="col-3 column items-evenly q-px-md q-gutter-md">
					<q-input
						:model-value="savesFolder.name"
						readonly
						:label="t('saveFolder')"
					>
						<template #after
							><q-btn @click="askSavesFolder()" outline>{{
								t('change')
							}}</q-btn>
						</template>
					</q-input>
					<q-input
						:model-value="originalSave?.name"
						readonly
						class="q-mb-lg"
						:label="t('eldenRingSave')"
					>
						<template #after
							><q-btn @click="askOriginalSave()" outline>{{
								t('change')
							}}</q-btn>
						</template>
					</q-input>

					<q-form
						ref="saveForm"
						@submit="saveBackup()"
						@reset="clearForm()"
					>
						<q-select
							:model-value="folderName"
							use-input
							hide-selected
							fill-input
							:label="t('folderName')"
							input-debounce="0"
							:options="foldersToSelect"
							@input-value="folderName = $event"
							@filter="filterFn"
							:rules="[
								(val) =>
									(val && val.length > 0) ||
									t('validate.folderName'),
							]"
							><template #no-option>
								<q-item>
									<q-item-section class="text-italic">
										{{ t('emptyFolders') }}
									</q-item-section>
								</q-item>
							</template>
						</q-select>
						<q-input
							v-model="saveName"
							:label="t('saveName')"
							clearable
							:rules="[
								(val) =>
									(val && val.length > 0) ||
									t('validate.saveName'),
							]"
						></q-input>

						<q-btn
							type="submit"
							color="primary"
							:label="t('saveBackup')"
						></q-btn>
					</q-form>
				</div>

				<q-separator vertical />

				<div class="col-3 q-pl-md">
					<q-tree
						ref="savesTree"
						:nodes="structure"
						node-key="label"
						no-connectors
						:no-nodes-label="t('emptyStructure')"
						default-expand-all
					>
						<template #default-header="{ key, node }">
							<div
								class="full-width row justify-between items-center"
							>
								<span>
									{{ key }}
								</span>
								<div>
									<q-btn
										v-if="node.father !== undefined"
										@click="loadSave(node)"
										class="q-mr-sm"
										:icon="mdiUpload"
										outline
										color="primary"
										padding="sm"
										><q-tooltip>{{
											t('loadSave')
										}}</q-tooltip></q-btn
									>
									<q-btn
										@click="deleteObject(node)"
										:icon="mdiClose"
										outline
										padding="sm"
										><q-tooltip>{{
											t('deleteSave')
										}}</q-tooltip></q-btn
									>
								</div>
							</div>
						</template>
					</q-tree>
				</div>
			</div>
			<div v-else>
				<q-btn @click="askSavesFolder()" outline>{{
					t('selectSaveFolder')
				}}</q-btn>
			</div>
		</div>
		<div v-else>
			{{ t('incompatibleBrowser') }}

			<div class="row items-center justify-around q-pt-md">
				<div
					class="column items-center justify-center"
					v-for="browser in compatibleBrowsers"
					:key="browser.name"
				>
					<img :src="browser.image" width="50" />
					{{ browser.name }}
				</div>
			</div>
		</div>
	</q-page>
</template>

<script lang="ts">
export default {
	name: 'IndexPage',
};
</script>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { copyFileSystem } from '../utils/copyFileSystem';
import { mdiClose, mdiUpload } from '@quasar/extras/mdi-v6';
import { QForm, QTree, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { get, set } from 'idb-keyval';
const { t } = useI18n();
const $q = useQuasar();

let isCompatible = ref(
	window.showDirectoryPicker !== undefined &&
		window.showOpenFilePicker !== undefined
);
let compatibleBrowsers = [
	{
		name: 'Vivaldi',
		image: 'https://vivaldi.com/wp-content/themes/vivaldicom-theme/img/press/icons/viv_icon.png',
	},
	{
		name: 'Chrome',
		image: 'https://www.google.com/chrome/static/images/chrome-logo.svg',
	},
	{
		name: 'Edge',
		image: 'https://edgefrecdn.azureedge.net/welcome/sitecdn/img/icon-shadow.9976a83.png',
	},
];

let folderName = ref('');
let saveName = ref('');

let savesFolder = ref<FileSystemDirectoryHandle | undefined>(undefined);
let originalSave = ref<FileSystemFileHandle | undefined>(undefined);

let saveForm = ref<QForm>();
let savesTree = ref<QTree>();

onMounted(async () => {
	let cachedSavesFolder = await get('savesFolder');
	if (cachedSavesFolder !== undefined) {
		savesFolder.value = cachedSavesFolder;

		await requestAccessSavesFolder();
	}

	let cachedOriginalSave = await get('originalSave');
	if (cachedOriginalSave !== undefined) {
		originalSave.value = cachedOriginalSave;
	}
});

let filterFn = (val, update) => {
	update(() => {
		const needle = val.toLocaleLowerCase();
		foldersToSelect.value = structure.value
			.map((a) => a.label)
			.filter((v) => v.toLocaleLowerCase().indexOf(needle) > -1);
	});
};

let structure = ref([]);

let foldersToSelect = ref([]);

let askSavesFolder = async () => {
	savesFolder.value = await window.showDirectoryPicker();

	await requestAccessSavesFolder();

	await set('savesFolder', savesFolder.value);

	await loadStructure();

	folderName.value = '';
	saveName.value = '';
};

let loadStructure = async () => {
	structure.value.length = 0;

	for await (const item of savesFolder.value.values()) {
		if (item.kind === 'directory') {
			let dir = {
				label: item.name,
				children: [],
			};

			for await (const subitem of item.values()) {
				if (subitem.kind === 'file') {
					dir.children.push({
						label: subitem.name,
						father: item.name,
					});
				}
			}
			structure.value.push(dir);
		}
	}

	foldersToSelect.value = structure.value.map((a) => a.label);

	savesTree.value.expandAll();
};

let deleteObject = async (node: {
	label: string;
	father?: string;
	children?: { label: string; father: string }[];
}) => {
	if (node.father === undefined) {
		// It's a directory
		await savesFolder.value.removeEntry(node.label, { recursive: true });
	} else {
		// It's a file
		const fatherHandler = await savesFolder.value.getDirectoryHandle(
			node.father
		);

		await fatherHandler.removeEntry(node.label);
	}

	await loadStructure();
};

let requestAccessOriginalSave = async () => {
	return new Promise<void>(async (resolve, reject) => {
		let permission = await originalSave.value.queryPermission({
			mode: 'readwrite',
		});
		if (permission === 'prompt') {
			$q.dialog({
				title: t('requestPermission.originalSave.title'),
				message: t('requestPermission.originalSave.message', [
					originalSave.value.name,
				]),
				persistent: true,
				ok: {
					label: t('requestPermission.originalSave.ok.title'),
					color: 'primary',
				},
				cancel: {
					label: t('requestPermission.originalSave.cancel.title'),
					outline: true,
				},
			})
				.onOk(async () => {
					await originalSave.value.requestPermission({
						mode: 'readwrite',
					});

					await set('originalSave', originalSave.value);
					return resolve();
				})
				.onCancel(() => {
					originalSave.value = undefined;
					return reject();
				});
		} else if (permission === 'granted') {
			return resolve();
		} else {
			return reject();
		}
	});
};

let requestAccessSavesFolder = async () => {
	return new Promise<void>(async (resolve, reject) => {
		let permission = await savesFolder.value.queryPermission({
			mode: 'readwrite',
		});
		if (permission === 'prompt') {
			$q.dialog({
				title: t('requestPermission.savesFolder.title'),
				message: t('requestPermission.savesFolder.message', [
					savesFolder.value.name,
				]),
				// message: `Necesitamos que nos vuelvas a dar permiso para acceder a la carpeta ${savesFolder.value.name}`,
				persistent: true,
				ok: {
					label: t('requestPermission.savesFolder.ok.title'),
					color: 'primary',
				},
				cancel: {
					label: t('requestPermission.savesFolder.cancel.title'),
					outline: true,
				},
			})
				.onOk(async () => {
					await savesFolder.value.requestPermission({
						mode: 'readwrite',
					});

					await set('savesFolder', savesFolder.value);

					await loadStructure();
					return resolve();
				})
				.onCancel(() => {
					savesFolder.value = undefined;
					return reject();
				});
		} else if (permission === 'granted') {
			return resolve();
		} else {
			return reject();
		}
	});
};

let askOriginalSave = async () => {
	let [originalSaveHandler] = await window.showOpenFilePicker({
		multiple: false,
		excludeAcceptAllOption: true,
		types: [
			{
				accept: {
					'application/octet-stream': ['.sl2'],
				},
				description: t('eldenRingSave'),
			},
		],
	});

	originalSave.value = originalSaveHandler;

	await set('originalSave', originalSave.value);
};

let saveBackup = async () => {
	if (folderName.value === '' || saveName.value === '') {
		return;
	}

	if (originalSave.value === undefined) {
		await askOriginalSave();
	} else {
		await requestAccessOriginalSave();
	}

	let backupFolderHandler = await savesFolder.value.getDirectoryHandle(
		folderName.value,
		{ create: true }
	);

	const saveBackupHandler = await backupFolderHandler.getFileHandle(
		`${saveName.value} - ${originalSave.value.name}`,
		{
			create: true,
		}
	);

	await copyFileSystem(originalSave.value, saveBackupHandler);

	await loadStructure();

	saveForm.value.reset();
};
let clearForm = () => {
	saveName.value = '';
	folderName.value = '';
};

let loadSave = async (node: { father: string; label: string }) => {
	const fatherHandler = await savesFolder.value.getDirectoryHandle(
		node.father
	);

	let backupToLoadHandler = await fatherHandler.getFileHandle(node.label);

	await copyFileSystem(backupToLoadHandler, originalSave.value);
};
</script>
