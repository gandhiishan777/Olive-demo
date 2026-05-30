import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { TransferBranchInfoDefaultingToMain } from "./TransferBranchInfoDefaultingToMain";
import { TransferBranchInfoTrafficSplit } from "./TransferBranchInfoTrafficSplit";
export declare const TransferToAgentToolResultSuccessModelBranchInfo: core.serialization.Schema<serializers.TransferToAgentToolResultSuccessModelBranchInfo.Raw, ElevenLabs.TransferToAgentToolResultSuccessModelBranchInfo>;
export declare namespace TransferToAgentToolResultSuccessModelBranchInfo {
    type Raw = TransferToAgentToolResultSuccessModelBranchInfo.DefaultingToMain | TransferToAgentToolResultSuccessModelBranchInfo.TrafficSplit;
    interface DefaultingToMain extends TransferBranchInfoDefaultingToMain.Raw {
        branch_reason: "defaulting_to_main";
    }
    interface TrafficSplit extends TransferBranchInfoTrafficSplit.Raw {
        branch_reason: "traffic_split";
    }
}
