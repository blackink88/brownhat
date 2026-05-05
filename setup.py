from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = [line for line in f.read().strip().split("\n") if line and not line.startswith("#")]

setup(
    name="brownhat",
    version="0.1.1",
    description="Brown Hat Academy — custom Frappe LMS extensions",
    author="Brown Hat Academy",
    author_email="com.popa@gmail.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
