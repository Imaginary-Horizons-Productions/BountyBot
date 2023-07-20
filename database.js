const { Sequelize } = require('sequelize');

exports.database = new Sequelize({
	dialect: "sqlite",
	storage: "./db.sqlite",
});

exports.database.authenticate().then(() => {
	const { Guild, initModel: initGuild } = require("./source/models/guilds/Guild.js")
	const { GuildRank, initModel: initGuildRank } = require("./source/models/guilds/GuildRank.js")
	const { User, initModel: initUser } = require("./source/models/users/User.js");
	const { Hunter, initModel: initHunter } = require("./source/models/users/Hunter.js");
	const { Bounty, initModel: initBounty } = require("./source/models/bounties/Bounty.js")
	const { Completion, initModel: initCompletion } = require("./source/models/bounties/Completion.js")
	const { Toast, initModel: initToast } = require("./source/models/toasts/Toast.js")
	const { ToastRecipient, initModel: initToastRecipient } = require("./source/models/toasts/ToastRecipient.js")
	const { ToastSeconding, initModel: initToastSeconding } = require("./source/models/toasts/ToastSeconding.js")

	initGuild(exports.database);
	initGuildRank(exports.database);
	initUser(exports.database);
	initHunter(exports.database);
	initBounty(exports.database);
	initCompletion(exports.database);
	initToast(exports.database);
	initToastRecipient(exports.database);
	initToastSeconding(exports.database);

	GuildRank.Guild = GuildRank.belongsTo(Guild);
	Hunter.User = Hunter.belongsTo(User);
	Hunter.Guild = Hunter.belongsTo(Guild);
	Bounty.User = Bounty.belongsTo(User);
	Bounty.Guild = Bounty.belongsTo(Guild);
	Completion.Bounty = Completion.belongsTo(Bounty);
	Completion.User = Completion.belongsTo(User);
	Completion.Guild = Completion.belongsTo(Guild);
	Toast.Guild = Toast.belongsTo(Guild);
	Toast.User = Toast.belongsTo(User);
	ToastRecipient.Toast = ToastRecipient.belongsTo(Toast);
	ToastRecipient.User = ToastRecipient.belongsTo(User);
	ToastSeconding.Toast = ToastSeconding.belongsTo(Toast);
	ToastSeconding.User = ToastSeconding.belongsTo(User);

	exports.database.sync();
})
