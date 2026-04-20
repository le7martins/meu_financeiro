import S from '../styles.js';
export default function Field({label,children,style}){return <div style={{marginBottom:13,...style}}><label style={S.lbl}>{label}</label>{children}</div>;}
