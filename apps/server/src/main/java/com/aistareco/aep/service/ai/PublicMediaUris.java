package com.aistareco.aep.service.ai;

import com.aistareco.common.BusinessException;
import java.net.*;

/** Public media fetches never reach loopback, private networks, credentials or arbitrary service ports. */
public final class PublicMediaUris {
    private PublicMediaUris() {}
    public static URI require(String source) {
        try {
            URI uri=URI.create(source);int port=uri.getPort();
            if(!java.util.Set.of("http","https").contains(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null
                    || uri.getFragment()!=null || !publicHost(uri.getHost()) || port!=-1 && port!=80 && port!=443)throw new IllegalArgumentException();
            return uri;
        }catch(Exception e){throw BusinessException.badRequest("MEDIA_URL_INVALID","素材地址必须是公开的 HTTP 或 HTTPS 地址");}
    }
    public static boolean publicHost(String host) {
        try {
            InetAddress[] addresses=InetAddress.getAllByName(host);
            if(addresses.length==0)return false;
            for(InetAddress address:addresses) {
                if(address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress())return false;
                byte[] bytes=address.getAddress();
                if(address instanceof Inet4Address) {
                    int first=bytes[0]&255,second=bytes[1]&255;
                    if(first==0 || first>=224 || first==100&&(second&0xC0)==64
                            || first==198&&(second==18||second==19))return false;
                } else if(address instanceof Inet6Address && (bytes[0]&0xFE)==0xFC)return false;
            }
            return true;
        }catch(Exception e){return false;}
    }

}
