### /about

> Usable in DMs: true

> Cooldown: 3 second(s)

Get BountyBot's description and contributors
### /bounty
> Permission Level: SendMessages

> Usable in DMs: false

> Cooldown: 3 second(s)

Bounties are user-created objectives for other server members to complete
#### /bounty post
Post your own bounty (+1 XP)
#### /bounty edit
Edit the title, description, image, or time of one of your bounties
#### /bounty swap
Move one of your bounties to another slot to change its reward
#### /bounty showcase
Show the embed for one of your existing bounties and increase the reward
#### /bounty add-completers
Add hunter(s) to a bounty's list of completers
#### /bounty remove-completers
Remove hunter(s) from a bounty's list of completers
#### /bounty complete
Close one of your open bounties, awarding XP to completers
#### /bounty take-down
Take down one of your bounties without awarding XP (forfeit posting XP)
#### /bounty list
List all of a hunter's open bounties (default: your own)
### /commands

> Usable in DMs: true

> Cooldown: 3 second(s)

Get a link to BountyBot's commands page
### /config-premium
> Permission Level: ManageGuild

> Usable in DMs: false

> Cooldown: 3 second(s)

Configure premium BountyBot settings for this server
#### level-threshold-multiplier (optional)
Configure the XP coefficient for bounty hunter levels (default 3)
#### bounty-slots (optional)
Configure the max number (between 1 and 10) of bounty slots hunters can have (default 5)
#### toast-thumbnail-url (optional)
Configure the image shown in the thumbnail of toasts
#### open-bounty-thumbnail-url (optional)
Configure the image shown in the thumbnail of open bounties
#### completed-bounty-thumbnail-url (optional)
Configure the image shown in the thumbnail of completed bounties
#### scoreboard-thumbnail-url (optional)
Configure the image shown in the thumbnail of the scoreboard
#### server-bonuses-thumbnail-url (optional)
Configure the image shown in the thumbnail of the server bonuses message
### /config-server
> Permission Level: ManageGuild

> Usable in DMs: false

> Cooldown: 3 second(s)

Configure BountyBot settings for this server
#### notification (optional)
> Choices: `Notify online members (@here)`, `Notify all members (@everyone)`, `No prefix`, `Suppress notifications (@silent)`

Configure who to send notifications to (default @here)
### /create-default
> Permission Level: ManageChannels

> Usable in DMs: false

> Cooldown: 30 second(s)

Create a Discord resource for use by BountyBot
#### /create-default bounty-board-forum
Create a new bounty board forum channel sibling to this channel
#### /create-default scoreboard-reference
Create a reference channel with the BountyBot Scoreboard
#### /create-default rank-roles
Create Discord roles and set them as this server's ranks at default variance thresholds
### /data-policy

> Usable in DMs: true

> Cooldown: 3 second(s)

Get a link to BountyBot's data policy page
### /evergreen
> Permission Level: ManageChannels

> Usable in DMs: false

> Cooldown: 3 second(s)

Evergreen Bounties are not closed after completion; ideal for server-wide objectives
#### /evergreen post
Post an evergreen bounty, limit 10
#### /evergreen edit
Change the name, description, or image of an evergreen bounty
#### /evergreen swap
Swap the rewards of two evergreen bounties
#### /evergreen showcase
Show the embed for an evergreen bounty
#### /evergreen complete
Awarding XP to a hunter for completing an evergreen bounty
#### /evergreen take-down
Take down one of your bounties without awarding XP (forfeit posting XP)
### /feedback
> Permission Level: SendMessages

> Usable in DMs: true

> Cooldown: 3 second(s)

Provide feedback on this bot to the developers
#### feedback-type
> Choices: `bug report`, `feature request`

the type of feedback you'd like to provide
### /festival
> Permission Level: ManageGuild

> Usable in DMs: false

> Cooldown: 3 second(s)

Manage a server-wide festival to multiply XP of bounty completions, toast reciepts, and crit toasts
#### /festival start
Start an XP multiplier festival
#### /festival close
End the festival, returning to normal XP
### /inventory
> Permission Level: ViewChannel

> Usable in DMs: true

> Cooldown: 3 second(s)

Show the user the items in their inventory
### /item
> Permission Level: SendMessages

> Usable in DMs: true

> Cooldown: 3 second(s)

Get details on a selected item and a button to use it
#### item-name
The item to look up details on
### /moderation
> Permission Level: ManageRoles

> Usable in DMs: false

> Cooldown: 3 second(s)

BountyBot moderation tools
#### /moderation user-report
Get the BountyBot moderation stats for a user
#### /moderation take-down
Take down another user's bounty
#### /moderation season-disqualify
Toggle disqualification from ranking for a bounty hunter in the current season
#### /moderation xp-penalty
Reduce a bounty hunter's XP
#### /moderation bountybot-ban
Toggle whether the provided user can interact with bounties or toasts
### /premium

> Usable in DMs: true

> Cooldown: 3 second(s)

List perks for supporting IHP development
### /raffle
> Permission Level: ManageGuild

> Usable in DMs: true

> Cooldown: 3 second(s)

Randomly select a bounty hunter from a variety of pools
#### /raffle by-rank
Select a user at or above a particular rank
#### /raffle by-level
Select a user at or above a particular level
#### /raffle announce-upcoming
Announce an upcoming raffle
### /rank
> Permission Level: ManageRoles

> Usable in DMs: false

> Cooldown: 3 second(s)

Seasonal Ranks distinguish bounty hunters who have above average season XP
#### /rank info
Get the information about an existing seasonal rank
#### /rank add
Add a seasonal rank for showing outstanding bounty hunters
#### /rank edit
Change the role or rankmoji for a seasonal rank
#### /rank remove
Remove an existing seasonal rank
### /reset
> Permission Level: ManageGuild

> Usable in DMs: false

> Cooldown: 3 second(s)

Reset all bounty hunter stats, bounties, or server configs
#### /reset all-hunter-stats
IRREVERSIBLY reset all bounty hunter stats on this server
#### /reset server-settings
IRREVERSIBLY return all server configs to default
### /scoreboard

> Usable in DMs: false

> Cooldown: 3 second(s)

View the XP scoreboard
#### scoreboard-type
> Choices: `Season Scoreboard`, `Overall Scoreboard`

The Season Scoreboard only includes hunters with XP this season
### /season-end
> Permission Level: ManageGuild

> Usable in DMs: false

> Cooldown: 3 second(s)

Start a new season for this server, resetting ranks and placements
### /server-bonuses

> Usable in DMs: false

> Cooldown: 3 second(s)

Get info about the currently running server bonuses
### /stats

> Usable in DMs: false

> Cooldown: 3 second(s)

Get the BountyBot stats for yourself or someone else
#### bounty-hunter (optional)
Whose stats to check; BountyBot for the server stats, empty for yourself
### /toast
> Permission Level: SendMessages

> Usable in DMs: false

> Cooldown: 30 second(s)

Raise a toast to other bounty hunter(s), usually granting +1 XP
#### toastees
The mention(s) of the bounty hunter(s) to whom you are raising a toast
#### message
The text of the toast to raise
#### image-url (optional)
The URL to the image to add to the toast
### /tutorial

> Usable in DMs: true

> Cooldown: 3 second(s)

Get tips for starting with BountyBot
#### tutorial-type
> Choices: `Starting Bounty Hunter Tips`, `Server Setup Tips`

Get starting bounty hunter tips or server setup tips
### /version

> Usable in DMs: true

> Cooldown: 3 second(s)

Get the most recent changes or the full change log
#### notes-length
> Choices: `Last version`, `Full change log`

Get the changes in last version or the full change log
