# BountyBot Change Log
## BountyBot Version 2.10.0:
### User Options in Slash Commands
Slash commands originally accepted users as a string (instead of Discord's user filtering) to allow users to mention as many users as they wanted. However, this doesn't work on mobile, so those slash commands have been remade to use Discord's user filtering.
- `/toast` now requires 1 toastee and up to 4 optional ones. The `message` option has been changed to the first option to group the toastee options.
- `/bounty add-completers` has been renamed to `/bounty verify-turn-in` and now requires 1 bounty hunter and up to 4 optional ones.
- `/bounty complete` now accepts up to 5 optional hunters.
### Other Changes
- Added `/seasonal-ranks`, which allows all bounty hunters to look up the server's list of seasonal ranks (removed `/rank info` which was only usable by Premium users)
- Fixed BountyBot banned users being able to receive toasts

## BountyBot Version 2.9.0:
### Server Goals
Server Goals are BountyBot objectives everyone on the server contributes to. A goal can require bounty completions, toasts, or toast secondings, with numbers depending on active bounty hunters on your server. A goal can be started by a bounty hunter using a Goal Initializer item on your server, and will reward contributors to the goal with XP and double item find on their next bounty completion. Server Goal progress can be found on the scoreboard. The bounty hunter with the most Server Goal contributions will receive a shoutout at the end of the season.

### Other Changes
- New items: Goal Initializer, Progress-in-a-Can
- New commands: `/moderation revoke-contributions`, `/moderation revoke-goal-bonus`
- Added Festival and Raffle indicators to the scoreboard, removed /server-bonuses
- Fixed crashes when toasting, completing bounties, or seconding toasts in threads
- Added an optional text input for `/evergreen showcase` to allow moderators to add text to the showcase message
- Fixed `/bounty edit` and `/evergreen edit` not saving modifications
- Fixed crash when using `/create-default rank-roles` twice in a row
- Fixed `/moderation user-report` listing XP awarded for recent bounties as "undefined"
- Fixed Dark Purple Profile Colorizer not dropping
- Item drops are now limited to 2 items per day, or 4 items for Premium users

## BountyBot Version 2.8.0:
### Context Menu Options
- Added the following BountyBot functionality to the Apps dropdown when right-clicking on a User or Message:
   - Check BountyBot Stats
   - Raise a Toast
   - Grant Bounty Credit
### End of Season Shoutouts
When a season ends, the following bounty hunters will be recognized in the end of season message:
- The hunter placed \#1 in season xp
- The hunter who posted the most bounties completed in the season
- The hunter who raised the most toasts in the season
### New Items
- Bonus Bounty Showcase: allows the hunter to showcase and increase the reward on one of their bounties on a separate cooldown from the command
- Bounty Thumbnail: allows a bounty's poster to add a thumbnail image to one of their bounties (also increasing completion XP for the poster)
### Other Changes
- Fixed `/bounty complete` mentioning the bounty board instead of the completed bounty's thread
- Fixed a bug where bounty posters were receiving item drops completers were stated to have recieved
- Converted all Light Green Profile Colorizers (which were unusable) to Light Grey Profile Colorizers

## BountyBot Version 2.7.1:
- Added cooldowns to items, these are applied per user
- Fixed a crash when using XP Boosts
- Fixed a crash when looking up Light Grey Profile Colorizers

## BountyBot Version 2.7.0:
- Added the ability to customize embed thumbnails per server in `/config-premium`
- `/item` now previews the color of Profile Colorizers in its own embed
- Fixed a bug where a hunter would gain XP for seconding a toast they were originally a recipient of
- Added a label for when a toast or seconding is a critical toast (awards the toaster XP)
- Adding completers to a bounty now sends a public message in the bounty board's thread (if it exists)
- Removing completers from a bounty now sends a public message in the bounty board's thread (if it exists)
- Editing a bounty now sends a message to mark the time of the edit in the bounty board's thread (if it exists)
- Fixed several crashs when handling bounties lacking descriptions

## BountyBot Version 2.6.1:
- Added XP Boosts: use them to gain XP in the used server
- The bot now announces when a bounty has been completed publically (so other bounty hunters know)
- The complete button on the bounty board now takes an input of a which channel to announce the bounty's completion in
- Completing a bounty without a bounty board now stows rewards lists in a thread

## BountyBot Version 2.6.0:
### Items
Items are consumables that are associated with a Discord account (rather than a server). They drop from bounties and do cool things when used.
- Look up which items you've found with `/inventory` then use them with `/item`
- Added Profile Colorizers: these come in many different colors and allow you to change the color of your profile in the server they're used in

### Other Changes
- A toast's raiser is no longer considered recieving secondings on that toast.
   - This lead to weird incentives to be the first to toast an event/achievement to get the secondings and not second toasts by competitors.
   - In the case of raising a toast to all members of a group from within a group, having someone else raise a toast to the first toast's raiser will achieve the same effect.
- Fixed crashes when using bounty board thread buttons

## BountyBot Version 2.5.1:
- Fixed a crash

## BountyBot Version 2.5.0:
- Bounty board forums created by `/create-default` now have 👀 as a default reaction
- BountyBot now provides shortcut links when mentioning its own commands
- Threads on the bounty board now include Complete, Add Completers, Remove Completers, Showcase, and Take Down buttons
- Bounty descriptions are now optional
- Adding a description, image, or start and end timestamps each add a 1 XP bonus to the poster's XP on completion

## BountyBot Version 2.4.0:
- Ephemeral messages in multi-step processes now clean themselves up
- Fixed a crash on `/bounty complete`
- Fixed a few other crashes and typos

## BountyBot Version 2.3.0:
- Each bounty hunter's most seconded toast (starting from this update) will be shown off in their `/stats`
- Completed bounties will now archive their posting threads on the bounty board forum
- Fixed a crash when editing a bounty whose thread title is too long

## BountyBot Version 2.2.0:
- The default created bounty board now includes the `Open` and `Completed` tags for searching for open bounties
- The Platinum, Gold, and Silver default rank roles are now hoisted (displays its members separately)
- Fixed a crash when using `/evergreen complete` on multiple completers
- Fixed `/season-end` not updating the scoreboard and not removing ranks roles
- Fixed a crash when editing a bounty whose thread has been archived

## BountyBot Version 2.1.1:
- Fixed several crashes

## BountyBot Version 2.1.0:
- Made `/bounty edit` feedback ephemeral so that it can't be used as a non-rate limited showcase
- Added `/moderation bountybot-ban` for permanently removing bounty and toast permission from users
- Fixed several crashes

## BountyBot Version 2.0.2:
- A toast's seconder is always filtered out of eligibility for xp
- Improved the formatting on rewards messages
- Renamed `/event` to `/festival` to disambiguate with Discord Scheduled Events
- Fixed the `/create-default scoreboard-reference` to immediately be usable as a reference channel

### Known Issues
- Functionality to permanently revoke access to BountyBot isn't usable yet

## BountyBot Version 2.0.1:
- Fixed the join link not asking for all needed permissions
- `/bounty list` defaults to your own bounties
- Posts to rewards threads are now silent

### Known Issues
- When a Toast's Recipient Seconds that toast, they aren't filtered out of getting XP again
- Seconding a toast doesn't update the scoreboard reference channel
- Rewards thread messages are missing some line breaks
- Functionality to permanently revoke access to BountyBot isn't usable yet
- The channel created by `/create-default scoreboard-reference` isn't immediately usable as a reference channel

## BountyBot Version 2.0.0:
- Slash command support! **ALL FEATURES** have been redone to use slash commands and message components (ie buttons and selects)
- Toasts can now be Seconded, letting other users toast the toastees and toaster in the same thread
- Showcasing your bounty now increases the reward on it (showcasing bounties is now rate-limited)
- Ground-up support for working in multiple servers
