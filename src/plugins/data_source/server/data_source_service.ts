/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Auditor,
  CoreSetup,
  LegacyCallAPIOptions,
  Logger,
  OpenSearchClient,
} from '../../../../src/core/server';
import { DataSourcePluginConfigType } from '../config';
import { configureClient, OpenSearchClientPool } from './client';
import { configureLegacyClient } from './legacy';
import { DataSourceClientParams } from './types';
import { registerTestConnection } from './routes/test_connection';
export interface DataSourceServiceSetup {
  getDataSourceClient: (params: DataSourceClientParams) => Promise<OpenSearchClient>;

  getDataSourceLegacyClient: (
    params: DataSourceClientParams
  ) => {
    callAPI: (
      endpoint: string,
      clientParams?: Record<string, any>,
      options?: LegacyCallAPIOptions
    ) => Promise<unknown>;
  };
}
export class DataSourceService {
  private readonly openSearchClientPool: OpenSearchClientPool;
  private readonly legacyClientPool: OpenSearchClientPool;
  private readonly legacyLogger: Logger;

  constructor(private logger: Logger) {
    this.legacyLogger = logger.get('legacy');
    this.openSearchClientPool = new OpenSearchClientPool(logger);
    this.legacyClientPool = new OpenSearchClientPool(this.legacyLogger);
  }

  async setup(
    config: DataSourcePluginConfigType,
    core: CoreSetup
  ): Promise<DataSourceServiceSetup> {
    const opensearchClientPoolSetup = await this.openSearchClientPool.setup(config);
    const legacyClientPoolSetup = await this.legacyClientPool.setup(config);

    const getDataSourceClient = async (
      params: DataSourceClientParams
    ): Promise<OpenSearchClient> => {
      return configureClient(params, opensearchClientPoolSetup, config, this.logger);
    };

    const getDataSourceLegacyClient = (params: DataSourceClientParams) => {
      return {
        callAPI: (
          endpoint: string,
          clientParams?: Record<string, any>,
          options?: LegacyCallAPIOptions
        ) =>
          configureLegacyClient(
            params,
            { endpoint, clientParams, options },
            legacyClientPoolSetup,
            config,
            this.legacyLogger
          ),
      };
    };

    /* Register the internal endpoint used for Endpoint validation - Test Connection */
    const router = core.http.createRouter();
    registerTestConnection(router, config, opensearchClientPoolSetup);

    return { getDataSourceClient, getDataSourceLegacyClient };
  }

  start() {}

  stop() {
    this.openSearchClientPool.stop();
  }
}
