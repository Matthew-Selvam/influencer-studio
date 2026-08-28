// FanFlow — shared error types across providers.
// Generalized from the old OllamaModelError so any provider can signal
// "the model isn't available" with a provider-specific hint.

export class ModelMissingError extends Error {
  constructor(model, hint) {
    super(`Model "${model}" is not available on this provider. ${hint}`)
    this.name = 'ModelMissingError'
    this.model = model
    this.hint = hint
  }
}
