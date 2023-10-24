const { Sequelize } = require('sequelize');

exports.database = new Sequelize({
	dialect: "sqlite",
	storage: "./db.sqlite",
});

exports.database.authenticate().then(() => {
	const { Company, initModel: initCompany } = require("./source/models/companies/Company.js");
	const { CompanyRank, initModel: initCompanyRank } = require("./source/models/companies/CompanyRank.js");
	const { User, initModel: initUser } = require("./source/models/users/User.js");
	const { Hunter, initModel: initHunter } = require("./source/models/users/Hunter.js");
	const { Bounty, initModel: initBounty } = require("./source/models/bounties/Bounty.js");
	const { Completion, initModel: initCompletion } = require("./source/models/bounties/Completion.js");
	const { Toast, initModel: initToast } = require("./source/models/toasts/Toast.js");
	const { ToastRecipient, initModel: initToastRecipient } = require("./source/models/toasts/ToastRecipient.js");
	const { ToastSeconding, initModel: initToastSeconding } = require("./source/models/toasts/ToastSeconding.js");
	const { Season, initModel: initSeason } = require("./source/models/seasons/Season.js");
	const { SeasonParticpation, initModel: initSeasonParticipation } = require("./source/models/seasons/SeasonParticipation.js");

	initCompany(exports.database);
	initCompanyRank(exports.database);
	initUser(exports.database);
	initHunter(exports.database);
	initBounty(exports.database);
	initCompletion(exports.database);
	initToast(exports.database);
	initToastRecipient(exports.database);
	initToastSeconding(exports.database);
	initSeason(exports.database);
	initSeasonParticipation(exports.database);

	Company.CompanyRanks = Company.hasMany(CompanyRank, {
		foreignKey: "companyId"
	});
	CompanyRank.Company = CompanyRank.belongsTo(Company, {
		foreignKey: "companyId"
	});

	Hunter.User = Hunter.belongsTo(User, {
		foreignKey: "userId"
	});
	User.Hunters = User.hasMany(Hunter, {
		foreignKey: "userId"
	});

	Hunter.Company = Hunter.belongsTo(Company, {
		foreignKey: "companyId"
	});
	Company.Hunters = Company.hasMany(Hunter, {
		foreignKey: "companyId"
	});

	Bounty.Company = Bounty.belongsTo(Company, {
		foreignKey: "companyId"
	});
	Company.Bounties = Company.hasMany(Bounty, {
		foreignKey: "companyId"
	});

	Completion.Bounty = Completion.belongsTo(Bounty, {
		foreignKey: "bountyId"
	});
	Bounty.Completions = Bounty.hasMany(Completion, {
		foreignKey: "bountyId"
	});

	Completion.User = Completion.belongsTo(User, {
		foreignKey: "userId"
	});
	User.Completions = User.hasMany(Completion, {
		foreignKey: "userId"
	});

	Completion.Company = Completion.belongsTo(Company, {
		foreignKey: "companyId"
	});
	Company.Completions = Company.hasMany(Completion, {
		foreignKey: "companyId"
	});

	Toast.Company = Toast.belongsTo(Company, {
		foreignKey: "companyId"
	});
	Company.Toasts = Company.hasMany(Toast, {
		foreignKey: "companyId"
	});

	Toast.User = Toast.belongsTo(User, {
		foreignKey: "senderId"
	});
	User.Toasts = User.hasMany(Toast, {
		foreignKey: "senderId"
	});

	ToastRecipient.Toast = ToastRecipient.belongsTo(Toast, {
		foreignKey: "toastId"
	});
	Toast.ToastRecipients = Toast.hasMany(ToastRecipient, {
		foreignKey: "toastId"
	});

	ToastRecipient.User = ToastRecipient.belongsTo(User, {
		foreignKey: "recipientId"
	});
	User.ToastRecipients = User.hasMany(ToastRecipient, {
		foreignKey: "recipientId"
	});

	ToastSeconding.Toast = ToastSeconding.belongsTo(Toast, {
		foreignKey: "toastId"
	});
	Toast.ToastSecondings = Toast.hasMany(ToastSeconding, {
		foreignKey: "toastId"
	});

	ToastSeconding.User = ToastSeconding.belongsTo(User, {
		foreignKey: "seconderId"
	});
	User.ToastSecondings = User.hasMany(ToastSeconding, {
		foreignKey: "seconderId"
	});

	Season.Company = Season.belongsTo(Company, {
		foreignKey: "companyId"
	})
	Company.Seasons = Company.hasMany(Season, {
		foreignKey: "companyId"
	})

	User.SeasonParticipations = User.hasMany(SeasonParticpation, {
		foreignKey: "userId"
	})
	SeasonParticpation.User = SeasonParticpation.belongsTo(User, {
		foreignKey: "userId"
	})

	Company.SeasonParticipations = Company.hasMany(SeasonParticpation, {
		foreignKey: "companyId"
	})
	SeasonParticpation.Company = SeasonParticpation.belongsTo(Company, {
		foreignKey: "companyId"
	})

	Season.SeasonParticipations = Season.hasMany(SeasonParticpation, {
		foreignKey: "seasonId"
	})
	SeasonParticpation.Season = SeasonParticpation.belongsTo(Season, {
		foreignKey: "seasonId"
	})

	exports.database.sync();
})
