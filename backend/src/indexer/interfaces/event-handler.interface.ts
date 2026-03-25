import { ParsedContractEvent } from '../types/event-types';

/**
 * Interface for event handlers
 * Each handler processes a specific event type
 */
export interface IEventHandler {
  /**
   * The event type this handler processes
   */
  readonly eventType: string;

  /**
   * Handle a parsed contract event
   * @param event The parsed contract event
   * @returns Promise that resolves when processing is complete
   */
  handle(event: ParsedContractEvent): Promise<void>;

  /**
   * Validate event data before processing
   * @param event The parsed contract event
   * @returns true if valid, false otherwise
   */
  validate(event: ParsedContractEvent): boolean;
}

/**
 * Interface for event handler registry
 */
export interface IEventHandlerRegistry {
  /**
   * Register an event handler
   * @param handler The handler to register
   */
  register(handler: IEventHandler): void;

  /**
   * Get handler for a specific event type
   * @param eventType The event type
   * @returns The handler or undefined if not found
   */
  getHandler(eventType: string): IEventHandler | undefined;

  /**
   * Get all registered handlers
   * @returns Array of all handlers
   */
  getAllHandlers(): IEventHandler[];
}
