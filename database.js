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

	Guild.GuildRank = Guild.hasMany(GuildRank, {
		foreignKey: "guildId"
	});
	GuildRank.Guild = GuildRank.belongsTo(Guild, {
		foreignKey: "guildId"
	});

	Hunter.User = Hunter.belongsTo(User, {
		foreignKey: "userId"
	});
	User.Hunter = User.hasMany(Hunter, {
		foreignKey: "userId"
	});

	Hunter.Guild = Hunter.belongsTo(Guild, {
		foreignKey: "guildId"
	});
	Guild.Hunter = Guild.hasMany(Hunter, {
		foreignKey: "guildId"
	});

	Bounty.Guild = Bounty.belongsTo(Guild, {
		foreignKey: "guildId"
	});
	Guild.Bounty = Guild.hasMany(Bounty, {
		foreignKey: "guildId"
	});

	Completion.Bounty = Completion.belongsTo(Bounty, {
		foreignKey: "bountyId"
	});
	Bounty.Completion = Bounty.hasMany(Completion, {
		foreignKey: "bountyId"
	});

	Completion.User = Completion.belongsTo(User, {
		foreignKey: "userId"
	});
	User.Completion = User.hasMany(Completion, {
		foreignKey: "userId"
	});

	Completion.Guild = Completion.belongsTo(Guild, {
		foreignKey: "guildId"
	});
	Guild.Completion = Guild.hasMany(Completion, {
		foreignKey: "guildId"
	});

	Toast.Guild = Toast.belongsTo(Guild, {
		foreignKey: "guildId"
	});
	Guild.Toast = Guild.hasMany(Toast, {
		foreignKey: "guildId"
	});

	Toast.User = Toast.belongsTo(User, {
		foreignKey: "senderId"
	});
	User.Toast = User.hasMany(Toast, {
		foreignKey: "senderId"
	});

	ToastRecipient.Toast = ToastRecipient.belongsTo(Toast, {
		foreignKey: "toastId"
	});
	Toast.ToastRecipient = Toast.hasMany(ToastRecipient, {
		foreignKey: "toastId"
	});

	ToastRecipient.User = ToastRecipient.belongsTo(User, {
		foreignKey: "recipientId"
	});
	User.ToastRecipient = User.hasMany(ToastRecipient, {
		foreignKey: "recipientId"
	});

	ToastSeconding.Toast = ToastSeconding.belongsTo(Toast, {
		foreignKey: "toastId"
	});
	Toast.ToastSeconding = Toast.hasMany(ToastSeconding, {
		foreignKey: "toastId"
	});

	ToastSeconding.User = ToastSeconding.belongsTo(User, {
		foreignKey: "seconderId"
	});
	User.ToastSeconding = User.hasMany(ToastSeconding, {
		foreignKey: "seconderId"
	});

	exports.database.sync();
})
