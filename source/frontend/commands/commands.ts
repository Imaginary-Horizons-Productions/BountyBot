import { InteractionContextType, MessageFlags } from 'discord.js';
import { CommandFunctionality } from '../classes';

const mainId = "commands";
export default new CommandFunctionality(mainId, "Get a link to BountyBot's commands wiki", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Link the user to the repo Commands wiki page (automatically updated) */
	(interaction, theater, isDevMode) => {
		interaction.reply({ content: "Here's a [link to the BountyBot Commands page](<https://github.com/Imaginary-Horizons-Productions/BountyBot/wiki/Commands>).", flags: MessageFlags.Ephemeral });
	}
);
