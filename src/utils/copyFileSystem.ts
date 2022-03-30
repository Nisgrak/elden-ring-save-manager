export async function copyFileSystem(
	origin: FileSystemFileHandle,
	destination: FileSystemFileHandle
) {
	const originStream = await (await origin.getFile()).stream();

	const destinationStream = await destination.createWritable();

	await destinationStream.truncate(0);

	await originStream.pipeTo(destinationStream);
}
