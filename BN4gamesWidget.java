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
public final class BN4gamesWidget
    extends BSingleton
    implements BIJavaScript, BIFormFactorMax
{
//region /*+ ------------ BEGIN BAJA AUTO GENERATED CODE ------------ +*/
//@formatter:off
/*@ $com.johnsontechnicalservices.n4games.ux.BN4gamesWidget(2747097003)1.0$ @*/
/* Generated Sat Nov 15 12:33:18 EST 2025 by Slot-o-Matic (c) Tridium, Inc. 2012-2025 */

  public static final BN4gamesWidget INSTANCE = new BN4gamesWidget();

  //region Type

  @Override
  public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BN4gamesWidget.class);

  //endregion Type

//@formatter:on
//endregion /*+ ------------ END BAJA AUTO GENERATED CODE -------------- +*/
  private BN4gamesWidget() {}
  public JsInfo getJsInfo(Context cx) { return jsInfo; }

  private static final JsInfo jsInfo =
      JsInfo.make(
        BOrd.make("module://n4games/rc/N4gamesWidget.js"),
        BN4gamesJsBuild.TYPE
      );
}
