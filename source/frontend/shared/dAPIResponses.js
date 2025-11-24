/** @param {(error) => boolean} ignoreThese */
function butIgnoreCertainErrors(ignoreThese) {
	return (error) => {
		if (!ignoreThese(error)) {
			console.error(error);
		}
	}
}

/** Interaction collectors throw an error on timeout (which is a crash if uncaught) */
const butIgnoreDiscordInteractionCollectorErrors = butIgnoreCertainErrors((error) => error.code === DiscordjsErrorCodes.InteractionCollectorError);

const butIgnoreMissingPermissionErrors = butIgnoreCertainErrors((error => error.code === 50013));

module.exports = {
	butIgnoreCertainErrors,
	butIgnoreDiscordInteractionCollectorErrors,
	butIgnoreMissingPermissionErrors
}
