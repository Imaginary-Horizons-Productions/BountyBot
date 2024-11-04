const { Sequelize } = require('sequelize');

/** @param {string} mode */
function connectToDatabase(mode) {
	const sequelizeOptions = {
		dialect: "sqlite",
		storage: "./db.sqlite",
	};
	if (mode === "prod") {
		sequelizeOptions.logging = false;
	}
	const database = new Sequelize(sequelizeOptions);

	return database.authenticate().then(() => {
		const { Company, initModel: initCompany } = require("./source/models/companies/Company.js");
		const { Rank, initModel: initRank } = require("./source/models/companies/Rank.js");
		const { User, initModel: initUser } = require("./source/models/users/User.js");
		const { Item, initModel: initItem } = require("./source/models/users/Item.js");
		const { Hunter, initModel: initHunter } = require("./source/models/users/Hunter.js");
		const { Bounty, initModel: initBounty } = require("./source/models/bounties/Bounty.js");
		const { Completion, initModel: initCompletion } = require("./source/models/bounties/Completion.js");
		const { Toast, initModel: initToast } = require("./source/models/toasts/Toast.js");
		const { Recipient, initModel: initRecipient } = require("./source/models/toasts/Recipient.js");
		const { Seconding, initModel: initSeconding } = require("./source/models/toasts/Seconding.js");
		const { Season, initModel: initSeason } = require("./source/models/seasons/Season.js");
		const { Participation, initModel: initParticipation } = require("./source/models/seasons/Participation.js");
		const { Goal, initModel: initGoal } = require("./source/models/companies/Goal.js");
		const { Contribution, initModel: initContribution } = require("./source/models/companies/Contribution.js");

		initCompany(database);
		initRank(database);
		initUser(database);
		initItem(database);
		initHunter(database);
		initBounty(database);
		initCompletion(database);
		initToast(database);
		initRecipient(database);
		initSeconding(database);
		initSeason(database);
		initParticipation(database);
		initGoal(database);
		initContribution(database);

		Company.Ranks = Company.hasMany(Rank, {
			foreignKey: "companyId"
		});
		Rank.Company = Rank.belongsTo(Company, {
			foreignKey: "companyId"
		});

		Item.User = Item.belongsTo(User, {
			foreignKey: "userId"
		})
		User.Items = User.hasMany(Item, {
			foreignKey: "userId"
		})

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

		Goal.Company = Goal.belongsTo(Company, {
			foreignKey: "companyId"
		})
		Company.Goals = Company.hasMany(Goal, {
			foreignKey: "companyId"
		})

		Contribution.Goal = Contribution.belongsTo(Goal, {
			foreignKey: "goalId"
		})
		Goal.Contributions = Goal.hasMany(Contribution, {
			foreignKey: "goalId"
		})
		Contribution.User = Contribution.belongsTo(User, {
			foreignKey: "userId"
		})
		User.Contributions = User.hasMany(Contribution, {
			foreignKey: "userId"
		})

		return database.sync();
	})
};

module.exports = {
	connectToDatabase
};
