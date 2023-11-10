const { database } = require("../../../../database.js");
const hunters = require("./hunters.json");

const ihcId = "353575133157392385";
database.authenticate().then(() => {
	const { Company, initModel: initCompany } = require("../../../models/companies/Company.js");
	const { Rank, initModel: initRank } = require("../../../models/companies/Rank.js");
	const { User, initModel: initUser } = require("../../../models/users/User.js");
	const { Hunter, initModel: initHunter } = require("../../../models/users/Hunter.js");
	const { Bounty, initModel: initBounty } = require("../../../models/bounties/Bounty.js");
	const { Completion, initModel: initCompletion } = require("../../../models/bounties/Completion.js");
	const { Toast, initModel: initToast } = require("../../../models/toasts/Toast.js");
	const { Recipient, initModel: initRecipient } = require("../../../models/toasts/Recipient.js");
	const { Seconding, initModel: initSeconding } = require("../../../models/toasts/Seconding.js");
	const { Season, initModel: initSeason } = require("../../../models/seasons/Season.js");
	const { Participation, initModel: initParticipation } = require("../../../models/seasons/Participation.js");

	initCompany(database);
	initRank(database);
	initUser(database);
	initHunter(database);
	initBounty(database);
	initCompletion(database);
	initToast(database);
	initRecipient(database);
	initSeconding(database);
	initSeason(database);
	initParticipation(database);

	Company.Ranks = Company.hasMany(Rank, {
		foreignKey: "companyId"
	});
	Rank.Company = Rank.belongsTo(Company, {
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

	Recipient.Toast = Recipient.belongsTo(Toast, {
		foreignKey: "toastId"
	});
	Toast.Recipients = Toast.hasMany(Recipient, {
		foreignKey: "toastId"
	});

	Recipient.User = Recipient.belongsTo(User, {
		foreignKey: "recipientId"
	});
	User.Recipients = User.hasMany(Recipient, {
		foreignKey: "recipientId"
	});

	Seconding.Toast = Seconding.belongsTo(Toast, {
		foreignKey: "toastId"
	});
	Toast.Secondings = Toast.hasMany(Seconding, {
		foreignKey: "toastId"
	});

	Seconding.User = Seconding.belongsTo(User, {
		foreignKey: "seconderId"
	});
	User.Secondings = User.hasMany(Seconding, {
		foreignKey: "seconderId"
	});

	Season.Company = Season.belongsTo(Company, {
		foreignKey: "companyId"
	})
	Company.Seasons = Company.hasMany(Season, {
		foreignKey: "companyId"
	})

	User.Participations = User.hasMany(Participation, {
		foreignKey: "userId"
	})
	Participation.User = Participation.belongsTo(User, {
		foreignKey: "userId"
	})

	Company.Participations = Company.hasMany(Participation, {
		foreignKey: "companyId"
	})
	Participation.Company = Participation.belongsTo(Company, {
		foreignKey: "companyId"
	})

	Season.Participations = Season.hasMany(Participation, {
		foreignKey: "seasonId"
	})
	Participation.Season = Participation.belongsTo(Season, {
		foreignKey: "seasonId"
	})

	return database.sync();
}).then(() => {
	return database.models.Company.findOrCreate({ where: { id: ihcId } })
}).then(async () => {
	for (const id in hunters) {
		const user = await database.models.User.findByPk(id);
		if (!user) {
			await database.models.User.create({ id, isPremium: ["112785244733628416", "106122478715150336"].includes(id) });
		}
		const hunter = await database.models.Hunter.findOne({ where: { userId: id, companyId: ihcId } });
		if (!hunter) {
			await database.models.Hunter.create({ userId: id, companyId: ihcId, xp: hunters[id].xp, isRankEligible: id !== "106122478715150336" });
		}
	}
});
