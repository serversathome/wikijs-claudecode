**Situation**
You are forking the Wiki.js project (https://github.com/Requarks/wiki), an open-source wiki software that has been largely abandoned by its original maintainers. The codebase needs modernization and a critical feature addition to support a content review workflow that doesn't currently exist in the permissions model.

**Task**
The assistant should perform three primary tasks:

1. Fork the Wiki.js repository from https://github.com/Requarks/wiki and establish a maintainable codebase
2. Update all packages and dependencies to their latest compatible versions, ensuring the application remains functional after updates
3. Implement a new review workflow feature that allows non-admin users to submit page edits for approval rather than publishing directly, with admin users able to review and approve/reject these submissions before publication

**Objective**
Create a modernized, maintainable fork of Wiki.js with an enhanced permissions model that supports editorial review workflows, enabling organizations to maintain content quality control through admin approval of user-submitted edits.

**Knowledge**
Current Wiki.js permissions model operates on a binary edit/publish system where any user with edit permissions can immediately publish changes. The new feature must:

- Preserve the existing built-in editor functionality
- Add a submission state for edits made by non-admin users
- Create an admin review interface for pending submissions
- Maintain backward compatibility with existing Wiki.js installations where possible
- Integrate with Wiki.js's existing authentication and permissions architecture

The assistant should consider the following technical aspects:
- Wiki.js is built on Node.js with Vue.js frontend
- The permissions system will need database schema modifications to track submission states
- The editor interface requires UI changes to show "Submit for Review" vs "Publish" based on user role
- An admin dashboard or notification system is needed for pending review items

**Instructions**
The assistant should provide a comprehensive implementation plan that includes:

1. **Repository Setup**: Detailed steps for forking, cloning, and establishing the development environment
2. **Dependency Updates**: A systematic approach to updating packages including identifying breaking changes, testing strategies, and rollback procedures
3. **Feature Architecture**: Complete technical specification for the review workflow including:
   - Database schema changes needed for tracking edit submissions and their states
   - API endpoints required for submission, approval, and rejection workflows
   - Frontend components and UI modifications for both user and admin interfaces
   - Permission checks and role-based access control logic
4. **Implementation Roadmap**: Prioritized steps for executing the work with clear milestones
5. **Testing Strategy**: Approach for validating both the dependency updates and new feature functionality
6. **Migration Path**: Considerations for existing Wiki.js users who might adopt this fork

The assistant should identify potential technical challenges such as conflicts between updated dependencies and existing code, complexities in the permissions model integration, and user experience considerations for the review workflow. Provide specific code examples, file locations, and architectural patterns where relevant to Wiki.js's existing structure.