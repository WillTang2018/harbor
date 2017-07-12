import { Component, OnInit, EventEmitter, Output, ViewChild, Input } from '@angular/core';

import { Configuration, ComplexValueItem } from './config';
import { REGISTRY_CONFIG_HTML } from './registry-config.component.html';
import { ConfigurationService, SystemInfoService, SystemInfo } from '../service/index';
import { toPromise } from '../utils';
import { ErrorHandler } from '../error-handler';
import {
    ReplicationConfigComponent,
    SystemSettingsComponent,
    VulnerabilityConfigComponent
} from './index';

import { ConfirmationState, ConfirmationTargets, ConfirmationButtons } from '../shared/shared.const';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { ConfirmationMessage } from '../confirmation-dialog/confirmation-message';
import { ConfirmationAcknowledgement } from '../confirmation-dialog/confirmation-state-message';
import { TranslateService } from '@ngx-translate/core';


@Component({
    selector: 'hbr-registry-config',
    template: REGISTRY_CONFIG_HTML
})
export class RegistryConfigComponent implements OnInit {
    config: Configuration = new Configuration();
    configCopy: Configuration;
    onGoing: boolean = false;
    systemInfo: SystemInfo;

    @Input() hasAdminRole: boolean = false;

    @ViewChild("replicationConfig") replicationCfg: ReplicationConfigComponent;
    @ViewChild("systemSettings") systemSettings: SystemSettingsComponent;
    @ViewChild("vulnerabilityConfig") vulnerabilityCfg: VulnerabilityConfigComponent;
    @ViewChild("cfgConfirmationDialog") confirmationDlg: ConfirmationDialogComponent;

    constructor(
        private configService: ConfigurationService,
        private errorHandler: ErrorHandler,
        private translate: TranslateService,
        private systemInfoService: SystemInfoService
    ) { }

    get shouldDisable(): boolean {
        return !this.isValid() || !this.hasChanges() || this.onGoing;
    }

    get hasCAFile(): boolean {
        return this.systemInfo && this.systemInfo.has_ca_root;
    }

    get withClair(): boolean {
        return this.systemInfo && this.systemInfo.with_clair;
    }

    ngOnInit(): void {
        //Get system info
        toPromise<SystemInfo>(this.systemInfoService.getSystemInfo())
            .then((info: SystemInfo) => this.systemInfo = info)
            .catch(error => this.errorHandler.error(error));

        //Initialize
        this.load();
    }

    isValid(): boolean {
        return this.replicationCfg &&
            this.replicationCfg.isValid &&
            this.systemSettings &&
            this.systemSettings.isValid &&
            this.vulnerabilityCfg &&
            this.vulnerabilityCfg.isValid;
    }

    hasChanges(): boolean {
        return !this._isEmptyObject(this.getChanges());
    }

    //Load configurations
    load(): void {
        this.onGoing = true;
        toPromise<Configuration>(this.configService.getConfigurations())
            .then((config: Configuration) => {
                this.onGoing = false;

                this.configCopy = this._clone(config);
                this.config = config;
            })
            .catch(error => {
                this.onGoing = false;

                this.errorHandler.error(error);
            });
    }

    //Save configuration changes
    save(): void {
        let changes: { [key: string]: any | any[] } = this.getChanges();

        if (this._isEmptyObject(changes)) {
            //Guard code, do nothing
            return;
        }

        this.onGoing = true;
        toPromise<any>(this.configService.saveConfigurations(changes))
            .then(() => {
                this.onGoing = false;

                this.translate.get("CONFIG.SAVE_SUCCESS").subscribe((res: string) => {
                    this.errorHandler.info(res);
                });
                //Reload to fetch all the updates
                this.load();
            })
            .catch(error => {
                this.onGoing = false;
                this.errorHandler.error(error);
            });
    }

    //Cancel the changes if have
    cancel(): void {
        let msg = new ConfirmationMessage(
            "CONFIG.CONFIRM_TITLE",
            "CONFIG.CONFIRM_SUMMARY",
            "",
            {},
            ConfirmationTargets.CONFIG
        );
        this.confirmationDlg.open(msg);
    }

    //Confirm cancel
    confirmCancel(ack: ConfirmationAcknowledgement): void {
        if (ack && ack.source === ConfirmationTargets.CONFIG &&
            ack.state === ConfirmationState.CONFIRMED) {
            this.reset();
        }
    }

    reset(): void {
        //Reset to the values of copy
        let changes: { [key: string]: any | any[] } = this.getChanges();
        for (let prop in changes) {
            this.config[prop] = this._clone(this.configCopy[prop]);
        }
    }

    getChanges(): { [key: string]: any | any[] } {
        let changes: { [key: string]: any | any[] } = {};
        if (!this.config || !this.configCopy) {
            return changes;
        }

        for (let prop in this.config) {
            let field = this.configCopy[prop];
            if (field && field.editable) {
                if (!this._compareValue(field.value, this.config[prop].value)) {
                    changes[prop] = this.config[prop].value;
                    //Number 
                    if (typeof field.value === "number") {
                        changes[prop] = +changes[prop];
                    }

                    //Trim string value
                    if (typeof field.value === "string") {
                        changes[prop] = ('' + changes[prop]).trim();
                    }
                }
            }
        }

        return changes;
    }

    //private
    _compareValue(a: any, b: any): boolean {
        if ((a && !b) || (!a && b)) return false;
        if (!a && !b) return true;

        return JSON.stringify(a) === JSON.stringify(b);
    }

    //private
    _isEmptyObject(obj: any): boolean {
        return !obj || JSON.stringify(obj) === "{}";
    }

    //Deeper clone all
    _clone(srcObj: any): any {
        if (!srcObj) return null;
        return JSON.parse(JSON.stringify(srcObj));
    }
}