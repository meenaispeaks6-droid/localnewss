import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Helmet>
        <title>Page not found — Local News</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div className="text-center">
        <h1 className="mb-4 font-heading text-4xl font-bold">404</h1>
        <p className="mb-4 text-muted-foreground">
          We couldn't find that page. Try picking a city from the homepage.
        </p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Return to Local News
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
