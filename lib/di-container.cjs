/**
 * Dependency Injection Container for Dragon-UI
 * Service registration, resolution, and lifecycle management
 *
 * @module lib/di-container
 */

'use strict';

/**
 * Service lifetime types
 */
const LIFETIME = {
  SINGLETON: 'singleton',
  TRANSIENT: 'transient',
  SCOPED: 'scoped'
};

/**
 * Service registration entry
 */
class ServiceRegistration {
  constructor(options) {
    this.name = options.name;
    this.factory = options.factory;
    this.lifetime = options.lifetime || LIFETIME.SINGLETON;
    this.dependencies = options.dependencies || [];
    this.instance = null;
    this.tags = options.tags || [];
  }
}

/**
 * Scope for scoped services
 */
class Scope {
  constructor(container) {
    this.container = container;
    this.instances = new Map();
    this.disposed = false;
  }

  /**
   * Resolve service within scope
   * @param {string} name
   * @returns {any}
   */
  resolve(name) {
    if (this.disposed) {
      throw new Error('Scope has been disposed');
    }

    const registration = this.container.registrations.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' is not registered`);
    }

    if (registration.lifetime === LIFETIME.SCOPED) {
      if (this.instances.has(name)) {
        return this.instances.get(name);
      }

      const instance = this.container.createInstance(registration);
      this.instances.set(name, instance);
      return instance;
    }

    return this.container.resolve(name);
  }

  /**
   * Dispose scope and all scoped instances
   */
  dispose() {
    for (const [name, instance] of this.instances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`[DI] Error disposing scoped service '${name}':`, error.message);
        }
      }
    }

    this.instances.clear();
    this.disposed = true;
  }
}

/**
 * Dependency Injection Container
 */
class DIContainer {
  constructor() {
    this.registrations = new Map();
    this.singletons = new Map();
    this.resolving = new Set();
    this.onRegisterCallbacks = [];
    this.onResolveCallbacks = [];
  }

  /**
   * Register a service
   * @param {string} name
   * @param {Function} factory
   * @param {Object} options
   * @returns {DIContainer}
   */
  register(name, factory, options = {}) {
    if (typeof factory !== 'function') {
      throw new Error(`Factory for '${name}' must be a function`);
    }

    const registration = new ServiceRegistration({
      name,
      factory,
      lifetime: options.lifetime || LIFETIME.SINGLETON,
      dependencies: options.dependencies || [],
      tags: options.tags || []
    });

    this.registrations.set(name, registration);

    // Notify callbacks
    for (const callback of this.onRegisterCallbacks) {
      callback(name, registration);
    }

    return this;
  }

  /**
   * Register a singleton service
   * @param {string} name
   * @param {Function} factory
   * @param {Object} options
   * @returns {DIContainer}
   */
  registerSingleton(name, factory, options = {}) {
    return this.register(name, factory, { ...options, lifetime: LIFETIME.SINGLETON });
  }

  /**
   * Register a transient service
   * @param {string} name
   * @param {Function} factory
   * @param {Object} options
   * @returns {DIContainer}
   */
  registerTransient(name, factory, options = {}) {
    return this.register(name, factory, { ...options, lifetime: LIFETIME.TRANSIENT });
  }

  /**
   * Register a scoped service
   * @param {string} name
   * @param {Function} factory
   * @param {Object} options
   * @returns {DIContainer}
   */
  registerScoped(name, factory, options = {}) {
    return this.register(name, factory, { ...options, lifetime: LIFETIME.SCOPED });
  }

  /**
   * Register an existing instance
   * @param {string} name
   * @param {any} instance
   * @returns {DIContainer}
   */
  registerInstance(name, instance) {
    const registration = new ServiceRegistration({
      name,
      factory: () => instance,
      lifetime: LIFETIME.SINGLETON
    });

    this.registrations.set(name, registration);
    this.singletons.set(name, instance);

    return this;
  }

  /**
   * Check if service is registered
   * @param {string} name
   * @returns {boolean}
   */
  isRegistered(name) {
    return this.registrations.has(name);
  }

  /**
   * Resolve a service
   * @param {string} name
   * @returns {any}
   */
  resolve(name) {
    const registration = this.registrations.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Check for circular dependency
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected for service '${name}'`);
    }

    let instance;

    switch (registration.lifetime) {
      case LIFETIME.SINGLETON:
        if (this.singletons.has(name)) {
          instance = this.singletons.get(name);
        } else {
          this.resolving.add(name);
          try {
            instance = this.createInstance(registration);
            this.singletons.set(name, instance);
          } finally {
            this.resolving.delete(name);
          }
        }
        break;

      case LIFETIME.TRANSIENT:
        this.resolving.add(name);
        try {
          instance = this.createInstance(registration);
        } finally {
          this.resolving.delete(name);
        }
        break;

      case LIFETIME.SCOPED:
        throw new Error(`Scoped service '${name}' must be resolved within a scope`);
    }

    // Notify callbacks
    for (const callback of this.onResolveCallbacks) {
      callback(name, instance);
    }

    return instance;
  }

  /**
   * Try to resolve a service (returns null if not found)
   * @param {string} name
   * @returns {any|null}
   */
  tryResolve(name) {
    try {
      return this.resolve(name);
    } catch {
      return null;
    }
  }

  /**
   * Resolve multiple services
   * @param {string[]} names
   * @returns {Object}
   */
  resolveMany(names) {
    const services = {};
    for (const name of names) {
      services[name] = this.resolve(name);
    }
    return services;
  }

  /**
   * Resolve services by tag
   * @param {string} tag
   * @returns {Array}
   */
  resolveByTag(tag) {
    const services = [];
    for (const [name, registration] of this.registrations) {
      if (registration.tags.includes(tag)) {
        services.push(this.resolve(name));
      }
    }
    return services;
  }

  /**
   * Create instance from registration
   * @param {ServiceRegistration} registration
   * @returns {any}
   */
  createInstance(registration) {
    // Resolve dependencies
    const dependencies = registration.dependencies.map(dep => this.resolve(dep));

    // Create instance
    return registration.factory(this, ...dependencies);
  }

  /**
   * Create a new scope
   * @returns {Scope}
   */
  createScope() {
    return new Scope(this);
  }

  /**
   * Unregister a service
   * @param {string} name
   * @returns {boolean}
   */
  unregister(name) {
    const existed = this.registrations.delete(name);

    // Clean up singleton if exists
    if (this.singletons.has(name)) {
      const instance = this.singletons.get(name);
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`[DI] Error disposing service '${name}':`, error.message);
        }
      }
      this.singletons.delete(name);
    }

    return existed;
  }

  /**
   * Clear all registrations
   */
  clear() {
    // Dispose all singletons
    for (const [name, instance] of this.singletons) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`[DI] Error disposing service '${name}':`, error.message);
        }
      }
    }

    this.registrations.clear();
    this.singletons.clear();
    this.resolving.clear();
  }

  /**
   * Get all registered service names
   * @returns {string[]}
   */
  getRegisteredServices() {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get registration info
   * @param {string} name
   * @returns {Object|null}
   */
  getRegistrationInfo(name) {
    const registration = this.registrations.get(name);
    if (!registration) return null;

    return {
      name: registration.name,
      lifetime: registration.lifetime,
      dependencies: registration.dependencies,
      tags: registration.tags,
      hasInstance: this.singletons.has(name)
    };
  }

  /**
   * Get all registrations info
   * @returns {Object[]}
   */
  getAllRegistrations() {
    const info = [];
    for (const name of this.registrations.keys()) {
      info.push(this.getRegistrationInfo(name));
    }
    return info;
  }

  /**
   * Add callback for service registration
   * @param {Function} callback
   */
  onRegister(callback) {
    this.onRegisterCallbacks.push(callback);
  }

  /**
   * Add callback for service resolution
   * @param {Function} callback
   */
  onResolve(callback) {
    this.onResolveCallbacks.push(callback);
  }

  /**
   * Validate all service dependencies
   * @returns {Object}
   */
  validateDependencies() {
    const errors = [];
    const warnings = [];

    for (const [name, registration] of this.registrations) {
      for (const dep of registration.dependencies) {
        if (!this.registrations.has(dep)) {
          errors.push(`Service '${name}' depends on unregistered service '${dep}'`);
        }
      }

      // Check for circular dependencies
      try {
        this.checkCircularDependency(name, new Set());
      } catch (error) {
        errors.push(error.message);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check for circular dependencies
   * @param {string} name
   * @param {Set} visited
   */
  checkCircularDependency(name, visited) {
    if (visited.has(name)) {
      throw new Error(`Circular dependency detected: ${Array.from(visited).join(' -> ')} -> ${name}`);
    }

    const registration = this.registrations.get(name);
    if (!registration) return;

    visited.add(name);

    for (const dep of registration.dependencies) {
      this.checkCircularDependency(dep, new Set(visited));
    }
  }

  /**
   * Build a dependency graph
   * @returns {Object}
   */
  buildDependencyGraph() {
    const graph = {};

    for (const [name, registration] of this.registrations) {
      graph[name] = {
        dependencies: registration.dependencies,
        dependents: []
      };
    }

    // Build reverse dependencies
    for (const [name, registration] of this.registrations) {
      for (const dep of registration.dependencies) {
        if (graph[dep]) {
          graph[dep].dependents.push(name);
        }
      }
    }

    return graph;
  }
}

// Global container instance
let globalContainer = null;

/**
 * Get global container
 * @returns {DIContainer}
 */
function getContainer() {
  if (!globalContainer) {
    globalContainer = new DIContainer();
  }
  return globalContainer;
}

/**
 * Create new container
 * @returns {DIContainer}
 */
function createContainer() {
  return new DIContainer();
}

/**
 * Reset global container
 */
function resetContainer() {
  if (globalContainer) {
    globalContainer.clear();
    globalContainer = null;
  }
}

/**
 * Decorator-like function to inject dependencies
 * @param {string[]} dependencies
 * @returns {Function}
 */
function inject(...dependencies) {
  return function(factory) {
    factory._dependencies = dependencies;
    return factory;
  };
}

/**
 * Initialize default services
 * @param {DIContainer} container
 */
function initializeDefaultServices(container) {
  const path = require('path');

  // Register database service
  container.registerSingleton('database', (c) => {
    const DatabaseService = require('../services/database.cjs');
    const dbPath = path.join(process.cwd(), 'usage.db');
    return new DatabaseService(dbPath);
  });

  // Register repositories
  container.registerSingleton('accountRepository', (c) => {
    const { AccountRepository } = require('./repository.cjs');
    const db = c.resolve('database');
    return new AccountRepository(db.db);
  }, { dependencies: ['database'], tags: ['repository'] });

  container.registerSingleton('requestRepository', (c) => {
    const { RequestRepository } = require('./repository.cjs');
    const db = c.resolve('database');
    return new RequestRepository(db.db);
  }, { dependencies: ['database'], tags: ['repository'] });

  container.registerSingleton('statsRepository', (c) => {
    const { StatsRepository } = require('./repository.cjs');
    const db = c.resolve('database');
    return new StatsRepository(db.db);
  }, { dependencies: ['database'], tags: ['repository'] });

  container.registerSingleton('agentPreferenceRepository', (c) => {
    const { AgentPreferenceRepository } = require('./repository.cjs');
    const db = c.resolve('database');
    return new AgentPreferenceRepository(db.db);
  }, { dependencies: ['database'], tags: ['repository'] });

  // Register services
  container.registerSingleton('analyticsService', (c) => {
    const { getAnalyticsDashboard } = require('../services/analytics-dashboard.cjs');
    const db = c.resolve('database');
    return getAnalyticsDashboard(db);
  }, { dependencies: ['database'], tags: ['service'] });

  container.registerSingleton('requestLogger', (c) => {
    const { getRequestLogger } = require('../services/request-logger.cjs');
    return getRequestLogger();
  }, { tags: ['service'] });

  container.registerSingleton('retentionManager', (c) => {
    const { getDataRetentionManager } = require('../services/data-retention.cjs');
    return getDataRetentionManager();
  }, { tags: ['service'] });

  container.registerSingleton('realtimeDashboard', (c) => {
    const { getRealtimeDashboard } = require('../services/realtime-dashboard.cjs');
    return getRealtimeDashboard();
  }, { tags: ['service', 'dashboard'] });

  return container;
}

module.exports = {
  DIContainer,
  Scope,
  ServiceRegistration,
  LIFETIME,
  getContainer,
  createContainer,
  resetContainer,
  inject,
  initializeDefaultServices
};
