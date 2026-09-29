import React from 'react';
import { createRoot } from 'react-dom/client';
import { Storefront } from './routes/index';
import './styles.css';
const node=document.getElementById('root');
if(node)createRoot(node).render(<Storefront/>);
