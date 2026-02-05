# BountyBot
BountyBot is a Discord bot that facilitates community interaction by allowing users to create server-wide quests and rewarding active server particpation.

## Adding BountyBot to your Server
[Click here](https://discord.com/oauth2/authorize?client_id=536330483852771348&permissions=2269452465006624&integration_type=0&scope=bot) to add BountyBot to your server! The bot will be managable by anyone who has a role above the bot's roles, so make sure to check role order when the bot joins!

### Permissions
Here are the permissions BountyBot asks for and a summary of what it uses each for:
- Manage Server: BountyBot uses this to check the server's automod rules to verify that bot posts made from user input follow the server's rules
- Manage Roles: BountyBot can be configured to distinguish active Bounty Hunters by making and granting roles
- Change Nickname: BountyBot nicknames itself to promote XP Festivals
- Create Events: Bounties created with start and end timestamps automatically create Discord events
- Manage Events: Discord events created for bounties with are updated when their bounty is
- Send Messages: BountyBot responds to commands in text channels, announces festival starts, etc
- Create Public Threads: BountyBot can create a bounty board forum where each bounty gets a thread for discussion and organization
- Send Messages in Threads: In bounty threads, BountyBot records updates or participation in bounties
- Manage Messages: BountyBot edits the scoreboard message when Bounty Hunters earn XP, edits messages in bounty threads for updates, etc.
- Pin Messages: On the bounty board forum, the thread containing the Evergreen Bounties (server-wide repeating bounties) is pinned
- Manage Threads: BountyBot updates bounty threads when their bounties are edited
- Embed Links: BountyBot refers users to the github for documentation and feedback
- Attach Files: BountyBot sends changelogs and other overflowing messages as text files
- Mention @everyone, @here, and All Roles: BountyBot can be configured to notify users when festivals or other server bonuses are starting

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
![stats](https://github.com/Imaginary-Horizons-Productions/BountyBot/blob/main/readme_images/stats.png)

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
![scoreboard](https://github.com/Imaginary-Horizons-Productions/BountyBot/blob/main/readme_images/scoreboard.png)

### Raffle Support
Server admins can use the `/raffle` commands to randomly select a bounty hunter by level or by rank.
![raffle](https://github.com/Imaginary-Horizons-Productions/BountyBot/blob/main/readme_images/raffle.png)

## Configure and Customize for *Your Server*
### Set Up in a Flash
Use the `/create-default` slash commands to have BountyBot automatically set up recommended ranks, a scoreboard resource, or a bounty board forum.

#### Bounty Board Forum
Organize your server's bounties in a forum so bounty hunters can browse through all the server's bounties at the same time. BountyBot sets up and manages the Open and Completed forum tags so bounty hunters can quickly filter for bounties they want to participate in.

![bountyboard](https://github.com/Imaginary-Horizons-Productions/BountyBot/blob/main/readme_images/bountyboard.png)

Bounty hunters can also use the `/bounty showcase` command to promote their bounties in relevant topic channels (with rate-limiting managed by the bot).

#### The Scoreboard Resource Channel
Though all bounty hunters can use `/scoreboard` from any text channel to get the current scoreboard, you can also have BountyBot post and update a scoreboard text channel that can be pinned to the Server Guide as a resource channel!

#### Rank Roles
BountyBot can create the Discord roles to associate with ranks automatically. Users with Premium can customize those ranks and their thresholds.

### Built-in Moderation
BountyBot rejects bounties and toasts containing words and phrases flagged in your server's AutoMod. Bot managers can also use the `/moderation` command to correct any problems that happen to fall through the cracks.

![moderation](https://github.com/Imaginary-Horizons-Productions/BountyBot/blob/main/readme_images/moderation.png)

## Sponsors
<!-- sponsors --><!-- sponsors -->
