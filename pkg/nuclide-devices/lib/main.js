/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import createPackage from '../../commons-atom/createPackage';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {DevicesPanelState, WORKSPACE_VIEW_URI} from './DevicesPanelState';
import {Disposable} from 'atom';
import invariant from 'invariant';
import {
  ServerConnection,
} from '../../nuclide-remote-connection/lib/ServerConnection';
import {combineEpics, createEpicMiddleware} from '../../commons-node/redux-observable';
import {applyMiddleware, createStore} from 'redux';
import {createEmptyAppState} from './redux/createEmptyAppState';
import * as Reducers from './redux/Reducers';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import {getDeviceInfoProviders, getDeviceListProviders} from './providers';

import type {WorkspaceViewsService} from '../../nuclide-workspace-views/lib/types';
import type {Store, DeviceListProvider, DeviceInfoProvider, DevicePanelServiceApi} from './types';

class Activation {
  _disposables: UniversalDisposable;
  _store: Store;

  constructor(state: ?Object) {
    const epics = Object.keys(Epics)
      .map(k => Epics[k])
      .filter(epic => typeof epic === 'function');
    this._store = createStore(
      Reducers.app,
      createEmptyAppState(),
      applyMiddleware(createEpicMiddleware(combineEpics(...epics))),
    );
    this._disposables = new UniversalDisposable(
      ServerConnection.observeRemoteConnections().subscribe(
        conns => {
          const hosts = conns.map(conn => conn.getUriOfRemotePath('/'));
          this._store.dispatch(Actions.setHosts(['local'].concat(hosts)));
        },
      ),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    this._disposables.add(
      api.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return new DevicesPanelState(this._store);
        }
      }),
      () => api.destroyWhere(item => item instanceof DevicesPanelState),
      atom.commands.add(
        'atom-workspace',
        'nuclide-devices:toggle',
        event => { api.toggle(WORKSPACE_VIEW_URI, (event: any).detail); },
      ),
    );
  }

  deserializeDevicePanelState(): DevicesPanelState {
    return new DevicesPanelState(this._store);
  }

  _refreshDeviceTypes(): void {
    this._store.dispatch(Actions.setDeviceTypes(
      Array.from(getDeviceListProviders()).map(p => p.getType()),
    ));
  }

  provideDevicePanelServiceApi(): DevicePanelServiceApi {
    let pkg = this;
    this._disposables.add(() => { pkg = null; });
    return {
      registerListProvider: (provider: DeviceListProvider) => {
        invariant(pkg != null, 'Device panel service API used after deactivation');
        const providers = getDeviceListProviders();
        providers.add(provider);
        this._refreshDeviceTypes();
        return new Disposable(() => {
          if (pkg != null) {
            providers.delete(provider);
            this._refreshDeviceTypes();
          }
        });
      },
      registerInfoProvider: (provider: DeviceInfoProvider) => {
        invariant(pkg != null, 'Device panel service API used after deactivation');
        const providers = getDeviceInfoProviders();
        providers.add(provider);
        return new Disposable(() => {
          if (pkg != null) {
            providers.delete(provider);
          }
        });
      },
    };
  }
}

createPackage(module.exports, Activation);
