package com.johnsontechnicalservices.n4games.ux;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraSingleton;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.sys.BSingleton;
import javax.baja.sys.Context;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;
import javax.baja.web.BIFormFactorMax;
import javax.baja.web.js.BIJavaScript;
import javax.baja.web.js.JsInfo;

@NiagaraType
@NiagaraSingleton
public final class BGame2048Widget
    extends BSingleton
    implements BIJavaScript, BIFormFactorMax
{
//region /*+ ------------ BEGIN BAJA AUTO GENERATED CODE ------------ +*/
//@formatter:off
/*@ $com.johnsontechnicalservices.n4games.ux.BGame2048Widget(2747097003)1.0$ @*/
/* Generated Sat Nov 15 16:32:16 EST 2025 by Slot-o-Matic (c) Tridium, Inc. 2012-2025 */

  public static final BGame2048Widget INSTANCE = new BGame2048Widget();

  //region Type

  @Override
  public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BGame2048Widget.class);

  //endregion Type

//@formatter:on
//endregion /*+ ------------ END BAJA AUTO GENERATED CODE -------------- +*/
  private BGame2048Widget() {}
  public JsInfo getJsInfo(Context cx) { return jsInfo; }

  private static final JsInfo jsInfo =
      JsInfo.make(
        BOrd.make("module://n4games/rc/game2048Widget.js"),
        BN4gamesJsBuild.TYPE
      );
}
