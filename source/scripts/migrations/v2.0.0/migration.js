const { database } = require("../../../../database.js");
const hunters = require("./hunters.json");

const ihcId = "353575133157392385";
database.authenticate().then(() => {
	const { Company, initModel: initCompany } = require("../../../models/companies/Company.js");
	const { CompanyRank, initModel: initCompanyRank } = require("../../../models/companies/CompanyRank.js");
	const { User, initModel: initUser } = require("../../../models/users/User.js");
	const { Hunter, initModel: initHunter } = require("../../../models/users/Hunter.js");
	const { Bounty, initModel: initBounty } = require("../../../models/bounties/Bounty.js");
	const { Completion, initModel: initCompletion } = require("../../../models/bounties/Completion.js");
	const { Toast, initModel: initToast } = require("../../../models/toasts/Toast.js");
	const { ToastRecipient, initModel: initToastRecipient } = require("../../../models/toasts/ToastRecipient.js");
	const { ToastSeconding, initModel: initToastSeconding } = require("../../../models/toasts/ToastSeconding.js");
	const { Season, initModel: initSeason } = require("../../../models/seasons/Season.js");
	const { SeasonParticpation, initModel: initSeasonParticipation } = require("../../../models/seasons/SeasonParticipation.js");

	initCompany(database);
	initCompanyRank(database);
	initUser(database);
	initHunter(database);
	initBounty(database);
	initCompletion(database);
	initToast(database);
	initToastRecipient(database);
	initToastSeconding(database);
	initSeason(database);
	initSeasonParticipation(database);

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

	return database.sync();
}).then(() => {
	return database.models.Company.create({ id: ihcId })
}).then(async () => {
	for (const id in hunters) {
		await database.models.User.create({ id, isPremium: ["112785244733628416", "106122478715150336"].includes(id) });
		await database.models.Hunter.create({ userId: id, companyId: ihcId, xp: hunters[id].xp, isRankEligible: id !== "106122478715150336" });
	}
})
