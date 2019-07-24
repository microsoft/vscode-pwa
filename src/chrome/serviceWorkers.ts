/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import Cdp from '../cdp/api';
import { FrameModel } from './frames';

export class ServiceWorkerRegistration {
  readonly versions = new Map<string, ServiceWorkerVersion>();
  readonly id: string;
  readonly scopeURL: string;
  constructor(payload: Cdp.ServiceWorker.ServiceWorkerRegistration) {
    this.id = payload.registrationId;
    this.scopeURL = payload.scopeURL;
  }
}

export class ServiceWorkerVersion  {
  readonly registration: ServiceWorkerRegistration;
  readonly revisions: Cdp.ServiceWorker.ServiceWorkerVersion[] = [];
  readonly id: string;
  readonly scriptURL: string;

  constructor(registration: ServiceWorkerRegistration, payload: Cdp.ServiceWorker.ServiceWorkerVersion) {
    this.registration = registration;
    this.id = payload.versionId;
    this.scriptURL = payload.scriptURL;
  }

  addRevision(payload: Cdp.ServiceWorker.ServiceWorkerVersion) {
    this.revisions.unshift(payload);
  }

  runningStatus(): string {
    if (this.revisions[0].runningStatus === 'running' || this.revisions[0].runningStatus === 'starting')
      return '🏃';
    return '🏁';
  }
}

export class ServiceWorkerModel {
  private _registrations = new Map<Cdp.ServiceWorker.RegistrationID, ServiceWorkerRegistration>();
  private _statuses = new Map<Cdp.Target.TargetID, Cdp.ServiceWorker.ServiceWorkerVersionStatus>();
  private _frameModel: FrameModel;
  private _cdp: Cdp.Api;
  private _onDidChangeUpdater = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChangeUpdater.event;

  constructor(frameModel: FrameModel) {
    this._frameModel = frameModel;
  }

  async addTarget(cdp: Cdp.Api) {
    if (this._cdp)
      return;
    // Use first available target connection.
    await cdp.ServiceWorker.enable({});
    cdp.ServiceWorker.on('workerRegistrationUpdated', event => this._workerRegistrationsUpdated(event.registrations));
    cdp.ServiceWorker.on('workerVersionUpdated', event => this._workerVersionsUpdated(event.versions));
    this._cdp = cdp;
  }

  versionStatus(targetId: Cdp.Target.TargetID): string | undefined {
    return this._statuses.get(targetId);
  }

  registrations(): ServiceWorkerRegistration[] {
    const result: ServiceWorkerRegistration[] = [];
    const urls = this._frameModel.frames().map(frame => frame.url());
    for (const registration of this._registrations.values()) {
      for (const url of urls) {
        if (url.startsWith(registration.scopeURL)) {
          result.push(registration);
          break;
        }
      }
    }
    return result;
  }

  registration(registrationId: Cdp.ServiceWorker.RegistrationID): ServiceWorkerRegistration | undefined {
    return this._registrations.get(registrationId);
  }

  _workerVersionsUpdated(payloads: Cdp.ServiceWorker.ServiceWorkerVersion[]): void {
    this._statuses.clear();
    for (const payload of payloads) {
      if (payload.targetId)
        this._statuses.set(payload.targetId, payload.status);
      const registration = this._registrations.get(payload.registrationId)!;
      let version = registration.versions.get(payload.versionId);
      if (!version) {
        version = new ServiceWorkerVersion(registration, payload);
        registration.versions.set(payload.versionId, version);
      }
      version.addRevision(payload);
      // TODO: display version tombstones.
      if (payload.runningStatus === 'stopped' && payload.status === 'redundant')
        registration.versions.delete(payload.versionId);
    }
    this._onDidChangeUpdater.fire();
  }

  _workerRegistrationsUpdated(payloads: Cdp.ServiceWorker.ServiceWorkerRegistration[]): void {
    for (const payload of payloads) {
      if (payload.isDeleted) {
        if (!this._registrations.has(payload.registrationId)) debugger;
        this._registrations.delete(payload.registrationId);
      } else {
        if (this._registrations.has(payload.registrationId))
          return;
        this._registrations.set(payload.registrationId, new ServiceWorkerRegistration(payload));
      }
    }
    this._onDidChangeUpdater.fire();
  }
}
