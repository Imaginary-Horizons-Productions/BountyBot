import { DiscordjsErrorCodes } from "discord.js";

// Discord API Opcodes and Status Codes: https://discord.com/developers/docs/topics/opcodes-and-status-codes

/** Creates a function to pass to a `Promise`'s `.catch` from an array of error kind check functions, often needed to avoid crashes when receiving errors back from external APIs like dAPI */
export function butIgnoreErrorIf(...ignoreThese: ((error: any) => boolean)[]) {
	return (error: any) => {
		for (const ignoreThis of ignoreThese) {
			if (ignoreThis(error)) {
				return;
			}
		}
		console.error(error);
	}
}

export const isAutomodError = (error: any) => [200000, 200001].includes(error.code);
export const isInteractionCollectorError = (error: any) => error.code === DiscordjsErrorCodes.InteractionCollectorError;
export const isUnknownChannelError = (error: any) => error.code === 10003;
export const isUnknownMessageError = (error: any) => error.code === 10008;
export const isUnknownGuildScheduledEventError = (error: any) => error.code === 10070;
export const isMissingPermissionError = (error: any) => error.code === 50013;
export const isCantDirectMessageThisUserError = (error: any) => error.code === 50007;

/** Interaction collectors throw an error on timeout (which is a crash if uncaught) */
export const butIgnoreInteractionCollectorErrors = butIgnoreErrorIf(isInteractionCollectorError);

export const butIgnoreUnknownChannelErrors = butIgnoreErrorIf(isUnknownChannelError);

export const butIgnoreUnknownMessageErrors = butIgnoreErrorIf(isUnknownMessageError);

export const butIgnoreMissingPermissionErrors = butIgnoreErrorIf(isMissingPermissionError);

export const butIgnoreCantDirectMessageThisUserErrors = butIgnoreErrorIf(isCantDirectMessageThisUserError);
