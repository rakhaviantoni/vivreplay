'use client';

import type {ReactNode} from 'react';
import {CardsIcon as Cards} from '@phosphor-icons/react';

export function VaultPanelEmpty({
  title,
  description,
  action,
  icon,
}: {
  title:string;
  description:string;
  action?:ReactNode;
  icon?:ReactNode;
}) {
  return <div className="vault-panel-empty">
    <span className="vault-panel-empty-icon" aria-hidden="true">{icon??<Cards size={21} weight="regular"/>}</span>
    <div className="vault-panel-empty-copy"><strong>{title}</strong><p>{description}</p></div>
    {action&&<div className="vault-panel-empty-actions">{action}</div>}
  </div>;
}
