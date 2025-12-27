package com.johnsontechnicalservices.n4games.ux;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraSingleton;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;
import javax.baja.web.js.BJsBuild;

@NiagaraType
@NiagaraSingleton
public final class BN4gamesJsBuild extends BJsBuild
{
//region /*+ ------------ BEGIN BAJA AUTO GENERATED CODE ------------ +*/
//@formatter:off
/*@ $com.johnsontechnicalservices.n4games.ux.BN4gamesJsBuild(2747097003)1.0$ @*/
/* Generated Sat Nov 15 12:33:18 EST 2025 by Slot-o-Matic (c) Tridium, Inc. 2012-2025 */

  public static final BN4gamesJsBuild INSTANCE = new BN4gamesJsBuild();

  //region Type

  @Override
  public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BN4gamesJsBuild.class);

  //endregion Type

//@formatter:on
//endregion /*+ ------------ END BAJA AUTO GENERATED CODE -------------- +*/
  private BN4gamesJsBuild()
  {
    super("n4games", BOrd.make("module://n4games/rc/n4games.built.min.js"));
  }
}
