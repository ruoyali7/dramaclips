import "server-only";
export type PublishingAccount={id:string;provider:string;displayLabel:string;platform:string;ready:boolean;readinessNote?:string};
export type PublishAsset={id:string;kind:"original"|"hook"|"upload";url:string;label:string;mimeType:"video/mp4";sizeBytes?:number;durationSeconds?:number};
export type RemoteMedia={id:string;provider:string;status:"uploading"|"ready"|"failed"};
export type PublishPostInput={idempotencyKey:string;accountId:string;asset:PublishAsset;caption:string;scheduledAt?:string;platformOptions?:Record<string,unknown>;confirm:boolean};
export type PublishResult={providerRequestId:string;status:"queued"|"scheduled"|"publishing"|"published";platformPostId?:string};
export type PublishStatus={status:"queued"|"uploading"|"scheduled"|"publishing"|"published"|"failed"|"canceled";platformPostId?:string;safeErrorCategory?:string};
export interface PublishingProvider{readonly name:string;listAccounts():Promise<PublishingAccount[]>;uploadMedia(asset:PublishAsset):Promise<RemoteMedia>;createPost(input:PublishPostInput):Promise<PublishResult>;getStatus(id:string):Promise<PublishStatus>}
