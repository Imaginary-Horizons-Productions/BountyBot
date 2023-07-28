### /about

> Usable in DMs: true

> Cooldown: 3 second(s)

Get BountyBot's description and contributors
### /bounty
> Permission Level: ViewChannel

> Usable in DMs: false

> Cooldown: 3 second(s)

Bounties are user-created objectives for other server members to complete
#### /bounty post
Post your own bounty (+1 XP)
#### /bounty edit
Edit the title, description, image, or time of one of your bounties
#### /bounty add-completers
Add hunter(s) to a bounty's list of completers
#### /bounty remove-completers
Remove hunter(s) from a bounty's list of completers
#### /bounty complete
Close one of your open bounties, awarding XP to completers
#### /bounty take-down
Take down one of your bounties without awarding XP (forfeit posting XP)
### /commands

> Usable in DMs: true

> Cooldown: 3 second(s)

Get a link to BountyBot's commands page
### /create-bounty-board
> Permission Level: ManageChannels

> Usable in DMs: false

> Cooldown: 30 second(s)

Create a new bounty board forum channel sibling to this channel
### /feedback
> Permission Level: SendMessages

> Usable in DMs: true

> Cooldown: 3 second(s)

Provide feedback on this bot to the developers
#### feedback-type
> Choices: `bug report`, `feature request`

the type of feedback you'd like to provide
### /premium
> Permission Level: ViewChannel

> Usable in DMs: true

> Cooldown: 3 second(s)

List perks for supporting IHP development
### /scoreboard

> Usable in DMs: false

> Cooldown: 3 second(s)

View the XP scoreboard
#### scoreboard-type
> Choices: `Season Scoreboard`, `Overall Scoreboard`

The Season Scoreboard only includes hunters with XP this season
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
### /version

> Usable in DMs: true

> Cooldown: 3 second(s)

Get the most recent changes or the full change log
#### get-recent-changes
Otherwise get the full change log
