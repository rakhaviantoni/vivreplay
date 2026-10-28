'use client';

import {BookmarkSimpleIcon as Bookmark,ChatCircleDotsIcon as Offers,ClipboardTextIcon as Listings,HeartIcon as Heart,ShoppingBagIcon as Orders,UserIcon as User,CaretDownIcon as CaretDown,SignOutIcon as SignOut,StorefrontIcon as Storefront} from '@phosphor-icons/react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import type {AccountState} from '@/lib/client';

type ActivityCounts={listings:number;offers:number;orders:number};
type QuickPanel='profile'|'vault'|'wishlist';

export function MarketAccountMenu({account,locale,activityCounts,proPaymentsCount,onOpenSection,onOpenQuick}:{account:AccountState;locale:'EN'|'ID';activityCounts:ActivityCounts;proPaymentsCount:number;onOpenSection:(panel:'listings'|'offers'|'orders'|'saved')=>void;onOpenQuick:(panel:QuickPanel)=>void}){
  const labels=locale==='ID';
  const unreadCount=activityCounts.listings+activityCounts.offers+activityCounts.orders+proPaymentsCount;
  const rows=[
    {panel:'listings' as const,label:labels?'Listing saya':'My listings',Icon:Listings,count:activityCounts.listings},
    {panel:'offers' as const,label:labels?'Penawaran':'Offers',Icon:Offers,count:activityCounts.offers},
    {panel:'orders' as const,label:labels?'Pesanan':'Orders',Icon:Orders,count:activityCounts.orders},
    {panel:'saved' as const,label:labels?'Listing tersimpan':'Saved listings',Icon:Bookmark,count:0},
  ];
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><button type="button" className="market-account-trigger" aria-label={labels?'Market saya: listing, penawaran, dan pesanan':'My Market: listings, offers, orders, and payments'}><Storefront size={16} aria-hidden="true"/>{unreadCount>0&&<span className="market-account-unread-badge">{Math.min(99,unreadCount)}</span>}<span className="market-account-trigger-name">{labels?'Market saya':'My Market'}</span><CaretDown size={14} aria-hidden="true"/></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={10} className="market-account-menu">
      <DropdownMenuLabel className="market-account-menu-label"><span className="market-account-menu-name">{account.profile.display_name||(labels?'Akun':'Account')}</span><span className="market-account-menu-handle">@{account.profile.username}</span></DropdownMenuLabel>
      <DropdownMenuSeparator/>
      {rows.map(({panel,label,Icon,count})=><DropdownMenuItem key={panel} className="market-account-menu-item" onSelect={()=>onOpenSection(panel)}><Icon size={16}/>{label}{count>0&&<span className="market-activity-badge">{count>99?'99+':count}</span>}</DropdownMenuItem>)}
      <DropdownMenuItem className="market-account-menu-item" onSelect={()=>onOpenQuick('wishlist')}><Heart size={16}/>{labels?'Kartu incaran':'Wishlist'}</DropdownMenuItem>
      <DropdownMenuItem className="market-account-menu-item" onSelect={()=>onOpenQuick('profile')}><User size={16}/>{labels?'Profil':'Profile'}{proPaymentsCount>0&&<span className="market-activity-badge">{proPaymentsCount>99?'99+':proPaymentsCount}</span>}</DropdownMenuItem>
      <DropdownMenuSeparator/>
      <DropdownMenuItem className="market-account-menu-item market-account-menu-signout" onSelect={()=>window.dispatchEvent(new Event('vivreplay:sign-out'))}><SignOut size={16}/>{labels?'Keluar':'Sign out'}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
