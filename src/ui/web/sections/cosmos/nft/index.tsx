import React, { FunctionComponent, useState } from "react";

import { Input } from "../../../../components/form";

import classames from "classnames";
import style from "./styles.module.scss";
import { Button } from "../../../../components/button";
import useForm from "react-hook-form";
import { observer } from "mobx-react";
import { useStore } from "../../../stores";
import {
  AccAddress,
  useBech32Config,
  useBech32ConfigPromise
} from "@everett-protocol/cosmosjs/common/address";
import { Coin } from "@everett-protocol/cosmosjs/common/coin";
import { Api } from "@everett-protocol/cosmosjs/core/api";
import { Rest } from "@everett-protocol/cosmosjs/core/rest";
import {
  defaultTxEncoder,
  StdTx
} from "@everett-protocol/cosmosjs/common/stdTx";
import { stdTxBuilder } from "@everett-protocol/cosmosjs/common/stdTxBuilder";
import { Context } from "@everett-protocol/cosmosjs/core/context";
import { GaiaRest } from "@everett-protocol/cosmosjs/gaia/rest";
import { Account } from "@everett-protocol/cosmosjs/core/account";
import { queryAccount } from "@everett-protocol/cosmosjs/core/query";
import { Codec } from "@node-a-team/ts-amino";
import * as Crypto from "@everett-protocol/cosmosjs/crypto";
import bigInteger from "big-integer";
import { Int } from "@everett-protocol/cosmosjs/common/int";
import { useNotification } from "../../../../components/notification";
import { MsgTransferNFT, registerCodec } from "../../../../../x/nft";

interface FormData {
  readonly recipient: string;
  readonly denom: string;
  readonly id: string;
}

export const NFTSection: FunctionComponent = observer(() => {
  const { register, handleSubmit, setValue, errors } = useForm<FormData>({
    defaultValues: {
      recipient: "",
      denom: "",
      id: ""
    }
  });

  const { chainStore } = useStore();

  const [loading, setLoading] = useState(false);

  const notification = useNotification();

  const clearForm = () => {
    setValue("recipient", "");
    setValue("denom", "");
    setValue("id", "");
  };

  return (
    <div className="columns is-gapless">
      <div className="column is-6-widescreen is-7-tablet">
        <div className={style.sendFormColumn}>
          <div className={classames("card", style.card)}>
            <form
              onSubmit={handleSubmit(async data => {
                const cosmosjs = new Api<Rest>(
                  {
                    chainId: chainStore.chainInfo.chainId,
                    // TODO: handle null wallet provider.
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    walletProvider: window.cosmosJSWalletProvider!,
                    rpc: chainStore.chainInfo.rpc,
                    // No need.
                    rest: "",
                    disableGlobalBech32Config: true
                  },
                  {
                    txEncoder: defaultTxEncoder,
                    txBuilder: stdTxBuilder,
                    restFactory: (context: Context) => {
                      return new GaiaRest(context);
                    },
                    queryAccount: (
                      context: Context,
                      address: string | Uint8Array
                    ): Promise<Account> => {
                      return queryAccount(
                        context.get("bech32Config"),
                        context.get("rpcInstance"),
                        address
                      );
                    },
                    bech32Config: chainStore.chainInfo.bech32Config,
                    bip44: chainStore.chainInfo.bip44,
                    registerCodec: (codec: Codec) => {
                      codec.registerConcrete(
                        "cosmos-sdk/StdTx",
                        StdTx.prototype
                      );
                      Crypto.registerCodec(codec);
                      registerCodec(codec);
                    }
                  }
                );

                await cosmosjs.enable();

                setLoading(true);

                const keys = await cosmosjs.getKeys();

                // This is not react hook.
                // eslint-disable-next-line react-hooks/rules-of-hooks
                useBech32ConfigPromise(
                  chainStore.chainInfo.bech32Config,
                  async () => {
                    const msg = new MsgTransferNFT(
                      new AccAddress(keys[0].address),
                      AccAddress.fromBech32(data.recipient),
                      data.denom,
                      data.id
                    );

                    try {
                      // TODO: change mode to commit.
                      const result = await cosmosjs.sendMsgs(
                        [msg],
                        {
                          gas: bigInteger(60000),
                          memo: "",
                          fee: new Coin(
                            chainStore.chainInfo.coinMinimalDenom.toLowerCase(),
                            new Int("0")
                          )
                        },
                        "commit"
                      );

                      if (result.mode === "commit") {
                        if (result.checkTx.code || result.deliverTx.code) {
                          notification.push({
                            type: "danger",
                            content: result.deliverTx.log
                              ? result.deliverTx.log
                              : result.checkTx.log
                              ? result.checkTx.log
                              : "",
                            duration: 5,
                            canDelete: true,
                            placement: "top-right",
                            transition: {
                              duration: 0.25
                            }
                          });
                        } else {
                          notification.push({
                            type: "success",
                            content: "Wait a second. Tx will be commited soon.",
                            duration: 5,
                            canDelete: true,
                            placement: "top-right",
                            transition: {
                              duration: 0.25
                            }
                          });
                        }
                      }
                    } catch (e) {
                      notification.push({
                        type: "danger",
                        content: e.toString(),
                        duration: 5,
                        canDelete: true,
                        placement: "top-right",
                        transition: {
                          duration: 0.25
                        }
                      });
                    } finally {
                      clearForm();
                      setLoading(false);
                    }
                  }
                );
              })}
            >
              <Input
                type="text"
                label="Recipient"
                name="recipient"
                error={errors.recipient && errors.recipient.message}
                ref={register({
                  required: "Recipient is required",
                  validate: value => {
                    // This is not react hook.
                    // eslint-disable-next-line react-hooks/rules-of-hooks
                    return useBech32Config(
                      chainStore.chainInfo.bech32Config,
                      () => {
                        try {
                          AccAddress.fromBech32(value);
                        } catch (e) {
                          return "Invalid address";
                        }
                      }
                    );
                  }
                })}
              />
              <Input
                type="text"
                label="Denom"
                name="denom"
                error={errors.amount && errors.amount.message}
                ref={register({
                  required: "Denom is required"
                })}
              />
              <Input
                type="text"
                label="ID"
                name="id"
                error={errors.memo && errors.memo.message}
                ref={register({
                  required: "ID is required"
                })}
              />
              <Button
                type="submit"
                color="primary"
                size="medium"
                fullwidth
                loading={loading}
              >
                Send
              </Button>
            </form>
          </div>
        </div>
      </div>
      <div className="column is-6-widescreen is-5-tablet">
        <div className={style.assetColumn}>
          <div className={classames("card")}>
            <div className="notification is-warning">
              Primar lorem ipsum dolor sit amet, consectetur adipiscing elit
              lorem ipsum dolor. <strong>Pellentesque risus mi</strong>, tempus
              quis placerat ut, porta nec nulla. Vestibulum rhoncus ac ex sit
              amet fringilla. Nullam gravida purus diam, et dictum{" "}
              <a>felis venenatis</a> efficitur. Sit amet, consectetur adipiscing
              elit
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
