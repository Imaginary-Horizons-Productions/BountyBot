Welcome prospective developers! We're so glad you've interested in helping out.

## Local Setup Instructions
1. Clone the repo
2. Setup your discord bot
3. Run `npm run initialize` from root
4. Populate the newly created `/config/auth.json`
5. Run `npm start:dev` from root to start the app

## Procedure
- Stories start as Discussions, where they are developed until they achieve Story Completion
- Restricting creating Issues until Story Completion (aka Story Approval) is intended to allow developers to confidently asynchronously select work on any Issue knowing that
   - The Issue is not a duplicate
   - The Issue's requirements are defined enough to complete the Story
   - The Issue is unlikely to be in conflict with other work
- When a Discussion achieves Story Completion, it is promoted to an Issue and the corresponding Discussion is deleted
- Issues may futher be grouped into Milestones, which represent the minimum Issues required to release the next version
- Issues not grouped into a Milestone can be added to any Milestone upon completion
- Each Issue should have its own Feature Branch
- When work on an Issue is complete, a Pull Request is opened to the relevant release branch (`main` is live)
- Pull Requests are to require `log10(active developers)` reviews
- Feature Branches are to be deleted after their Pull Requests are merged or rejected

## Style
- This project uses tabs for indentation to reduce file size and keypresses during code navigation
- Bot feedback messages should be written in 3rd-person passive tense (to avoid unnecessary personification) and make requests in polite language
    - Example: "Your bounty could not be posted. Please remove phrases disallowed by the server from the title and try again."

### File and Directory Naming Convention
Please use `camelCase` unless one of the following exceptions apply:
- Classes are in `PascalCase`
- Interaction instances match their customIds
   - Slash commands use `kebab-case` as part of Discord convention
   - Context menu commands have their customIds visible to the end user as the menu option name, and we use `Proper Noun Case` as a result
      - File names should match the customIds, but use underscores instead of spaces (like `Proper_Noun_Case.js`)
   - Others are `alllowercase`

## Migrations and Database Management
We us `sequelize-cli` for migration management (see `npx seqeulize help` for a list of its commands)

### Migration Writing Tips
- Migration SQL logging can be turned on by adding `logging: true` to the env in `./config/config.json`
   - This logging is off by default because it throws a deprecation error on regular startup
- Creating tables in migrations is considered best practice (so that shards aren't trying to race to finish that work), but the schemas for `queryInterface.createTable()` need to include even the properties Sequelize automatically manages (like auto-incrementing `id`s, `createdAt`, or `updatedAt`)
- `queryInterface.bulkUpdate()` will create an empty SET query if provided an empty `values` object (like if dynamic calculation finds no properties to update), causing a `SQLITE_ERROR: incomplete input`
