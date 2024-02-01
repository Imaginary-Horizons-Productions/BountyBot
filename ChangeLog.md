# BountyBot Change Log
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
