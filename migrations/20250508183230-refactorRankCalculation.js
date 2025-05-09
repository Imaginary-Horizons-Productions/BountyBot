'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
	//TODONOW add Season.xpStandardDeviation
	//TODONOW add Participation.rankIndex
	//TODONOW remove Hunter.rank
	//TODONOW remove Hunter.lastRank
	//TODONOW remove Hunter.nextRankXP
  },

  async down (queryInterface, Sequelize) {
	//TODONOW remove Season.xpStandardDeviation
	//TODONOW remove Participation.rankIndex
	//TODONOW recalculate Hunter.rank
	//TODONOW recalculate Hunter.lastRank
	//TODONOW recalculate Hunter.nextRankXP
  }
};
