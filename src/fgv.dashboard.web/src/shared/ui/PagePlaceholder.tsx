interface PagePlaceholderProps {
    title: string;
}

export default function PagePlaceholder({ title }: PagePlaceholderProps) {
    return (
        <section>
            <header className="page-head">
                <h1>{title}</h1>
                <p>Not migrated yet. The original page is still in the prototype.</p>
            </header>
        </section>
    );
}