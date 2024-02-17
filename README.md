# BountyBot
BountyBot is a Discord bot that facilitates community interaction by allowing users to create server-wide quests and rewarding active server particpation.

### Join Link
[Click here](https://discord.com/api/oauth2/authorize?client_id=536330483852771348&permissions=18135835404336&scope=bot%20applications.commands) to add BountyBot to your server! The bot will be managable by anyone who has a role above the bot's roles, so make sure to check role order when the bot joins!

## Beyond "Just Chatting"
Bounties allow server members to transform otherwise mundate activites into community events. Repeating bounties (aka Evergreen Bounties) turn one-off interactions into long term engagement.

Looking for quick recongition or doing something less planned? Raise a toast to participants to show your appreciation.

### Example Bounties
- __Party Up__ Get bounty hunters to join you for a game session
- __WTB/WTS__ Get the word out that you're looking to trade
- __Achievement Get__ Get help working toward an achievement
- __Trivia Night__ Add party favors (participation XP) to your events

## Rewarding Quality Interaction
### Level-Up!
As bounty hunters complete bounties and receive toasts, they'll gain XP towards leveling up!
![stats](source\images\readme\stats.png)

Level-up rewards can contain increasing the rewards on the user's posted bounties and more bounty slots.

### Rank Roles
Ranks can be awarded to bounty hunters based on how they are doing relative to the other bounty hunters in the server. Ranks can be configured to come with colored roles that are shown separate from other members in the server member list (all configurable!). The default roles are:
1. Platinum - 2.5 standard deviations above the mean XP earned in the season
2. Gold - 1 standard deviation above the mean XP earned in the season
3. Silver - at the mean XP earned in the season
4. Bronze - any participation at all

BountyBot also supports rotating seasons with (`/season-end`), so XP leads don't snowball out of control.

### Seasonal Placements
BountyBot will track who has earned the most experience in the current season.
![scoreboard](source\images\readme\scoreboard.png)

### Raffle Support
Server admins can use the `/raffle` commands to randomly select a bounty hunter by level or by rank.
![raffle](source\images\readme\raffle.png)

## Configure and Customize for *Your Server*
### Set Up in a Flash
Use the `/create-default` slash commands to have BountyBot automatically set up recommended ranks, a scoreboard resource, or a bounty board forum.

#### Bounty Board Forum
Organize your server's bounties in a forum so bounty hunters can browse through all the server's bounties at the same time. BountyBot sets up and manages the Open and Completed forum tags so bounty hunters can quickly filter for bounties they want to participate in.

![bountyboard](source\images\readme\bountyboard.png)

Bounty hunters can also use the `/bounty showcase` command to promote their bounties in relevant topic channels (with rate-limiting managed by the bot).

#### The Scoreboard Resource Channel
Though all bounty hunters can use `/scoreboard` from any text channel to get the current scoreboard, you can also have BountyBot post and update a scoreboard text channel that can be pinned to the Server Guide as a resource channel!

#### Rank Roles
BountyBot can create the Discord roles to associate with ranks automatically. Users with Premium can customize those ranks and their thresholds.

### Built-in Moderation
BountyBot rejects bounties and toasts containing words and phrases flagged in your server's AutoMod. Bot managers can also use the `/moderation` command to correct any problems that happen to fall through the cracks.

![moderation](source\images\readme\moderation.png)

## Sponsors
<!-- sponsors --><!-- sponsors -->
