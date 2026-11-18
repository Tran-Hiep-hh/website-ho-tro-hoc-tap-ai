# Layer contracts

`serviceInterfaces.d.ts` and `repositoryInterfaces.d.ts` are the explicit contracts shown as `I...Service` and `I...Repository` in the class diagram.

The backend remains JavaScript, so these declarations are design-time contracts for IDE support and documentation; they have no runtime effect. Concrete implementations remain in `../services` and `../repositories`.

Concrete factory functions reference these contracts with JSDoc `@returns` annotations. When the backend is migrated to TypeScript, they can be converted to `implements` declarations.
